import express from "express";
import cookieParser from "cookie-parser";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { loadConfig, findConfigPath, WIZARD_CONFIG_PATH } from "@foxbridge/config";
import { renameSync } from "node:fs";
import type { Server } from "node:http";
import { createSetupRouter } from "./routes/setup.js";
import { extractCredentials, createFoxbridgeServer } from "@foxbridge/mcp-servers";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SessionStore } from "./session.js";
import { createAuthRouter } from "./routes/auth.js";
import { createOAuthRouter } from "./routes/oauth.js";
import { createHealthRouter } from "./routes/health.js";
import { createChatRouter } from "./routes/chat.js";
import { createFeaturesRouter } from "./routes/features.js";
import { createJiraDetailRouter } from "./routes/jira-detail.js";
import { createLogger } from "./logger.js";
import multer from "multer";
import { requestIdMiddleware } from "./middleware/request-id.js";

export { SessionStore } from "./session.js";
export type { Session, ChatMessage } from "./session.js";
export { createAiProvider } from "./ai-provider.js";
export type { AiProviderConfig } from "./ai-provider.js";
export { createToolExecutor } from "./tool-executor.js";
export type { ToolExecutor, ToolExecutorClients } from "./tool-executor.js";
export { createLogger } from "./logger.js";
export type { Logger } from "./logger.js";

// Auto-start when run directly
const isMainModule =
  process.argv[1]?.replace(/\\/g, "/").includes("chat-backend/dist/index");
if (isMainModule) {
  startServer().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}

async function gracefulRestart(servers: Server[]): Promise<void> {
  for (const server of servers) {
    server.close();
  }
  // Wait up to 5s for in-flight requests to drain
  await new Promise((resolve) => setTimeout(resolve, 5000));
  process.exit(0);
}

export async function startServer(): Promise<Server[]> {
  const configPath = findConfigPath();

  // No config found — enter setup mode
  if (!configPath) {
    return startSetupMode();
  }

  // Config found — try to load it
  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    // If the config is wizard-owned (on data volume) and invalid, rename + enter setup mode
    if (configPath.startsWith("/var/lib/foxbridge/")) {
      console.error(`Invalid config at ${configPath}, renaming to .bad and entering setup mode`);
      try {
        renameSync(configPath, `${configPath}.bad`);
      } catch {}
      return startSetupMode();
    }
    throw err; // Re-throw for mounted/external configs
  }

  const log = createLogger(config);

  const sessionStore = new SessionStore();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  });

  // Chat server
  const chatApp = express();
  chatApp.use(express.json({ limit: "50kb" }));
  chatApp.use(cookieParser());
  chatApp.use(requestIdMiddleware);
  chatApp.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      log("info", `${req.method} ${req.path}`, {
        requestId: (req as any).requestId,
        status: res.statusCode,
        latency_ms: Date.now() - start,
      });
    });
    next();
  });
  // Setup status must exist in normal mode too — without it the SPA fallback
  // returns HTML here and the UI assumes setup is required (shows wizard).
  chatApp.get("/api/setup/status", (_req, res) => {
    res.json({ configured: true, configPath: findConfigPath() });
  });
  chatApp.use(createAuthRouter(config, sessionStore));
  if (config.oauth) {
    chatApp.use(createOAuthRouter(config, sessionStore));
  }
  chatApp.use(createHealthRouter(config));
  chatApp.use(createChatRouter(config, sessionStore, upload));
  chatApp.use(createFeaturesRouter(config));
  chatApp.use(createJiraDetailRouter(config, sessionStore));

  // Serve the chat UI static files
  // Try multiple locations: relative to cwd (dev/Docker), or relative to this file (npm global)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), "dist/public"),
    resolve(__dirname, "../../../dist/public"),
    resolve(__dirname, "../../public"),
  ];
  const publicDir = candidates.find((p) => existsSync(p)) ?? candidates[0];
  if (existsSync(publicDir)) {
    chatApp.use(express.static(publicDir));
    // SPA fallback — serve index.html for non-API routes
    chatApp.get("*", (_req, res) => {
      res.sendFile(resolve(publicDir, "index.html"));
    });
    log("info", `Serving chat UI from ${publicDir}`);
  } else {
    log("warn", `Chat UI not found at ${publicDir} — run 'npm run build' in packages/chat-ui`);
  }

  const chatServer = chatApp.listen(config.port_chat, () => {
    log("info", `Chat server listening on port ${config.port_chat}`);
  });

  // MCP server
  const mcpApp = express();
  mcpApp.use(express.json({ limit: "1mb" }));
  mcpApp.use(createHealthRouter(config));

  mcpApp.all("/mcp", async (req, res) => {
    try {
      const credentials = extractCredentials(
        new Headers(req.headers as Record<string, string>),
      );
      // Never share credentials or a connected Protocol instance between requests.
      const server = createFoxbridgeServer(config, credentials);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        void transport.close().catch(() => {});
        void server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(401).json({ error: err.message });
      }
    }
  });

  const mcpServer = mcpApp.listen(config.port_mcp, () => {
    log("info", `MCP server listening on port ${config.port_mcp}`);
  });

  chatServer.once("close", () => sessionStore.dispose());
  return [chatServer, mcpServer];
}

/**
 * Setup mode: minimal Express app that serves the setup wizard.
 * Only active when no valid config file is found.
 */
async function startSetupMode(): Promise<Server[]> {
  const port = Number(process.env["FOXBRIDGE_CHAT_PORT"] ?? 3000);

  const app = express();
  app.use(express.json({ limit: "50kb" }));

  // Health check returns setup_required status
  app.get("/healthz", (_req, res) => {
    res.json({ status: "setup_required" });
  });

  // Setup wizard API routes
  const servers: Server[] = [];
  app.use(createSetupRouter(() => gracefulRestart(servers)));

  // Serve the chat UI static files (includes setup wizard)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), "dist/public"),
    resolve(__dirname, "../../../dist/public"),
    resolve(__dirname, "../../public"),
  ];
  const publicDir = candidates.find((p) => existsSync(p)) ?? candidates[0];
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(resolve(publicDir, "index.html"));
    });
  }

  const server = app.listen(port, () => {
    console.log(`[setup] Foxbridge setup wizard at http://localhost:${port}`);
    console.log("[setup] No config file found. Complete the wizard to get started.");
  });
  servers.push(server);
  return servers;
}
