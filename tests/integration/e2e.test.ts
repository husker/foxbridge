import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import type { FoxbridgeConfig } from "@foxbridge/config";
import { SessionStore } from "../../packages/chat-backend/src/session.js";
import { createAuthRouter } from "../../packages/chat-backend/src/routes/auth.js";
import { createHealthRouter } from "../../packages/chat-backend/src/routes/health.js";
import { createChatRouter } from "../../packages/chat-backend/src/routes/chat.js";

const testConfig: FoxbridgeConfig = {
  atlassian: {
    base_url: "https://test.atlassian.net",
    platform: "cloud",
  },
  ai: {
    provider: "anthropic",
    api_key: "sk-ant-test-key",
    model: "claude-sonnet-4-6",
  },
  features: {
    jira: { read: true, write: false },
    confluence: { read: true, write: true },
    bitbucket: { read: false, write: false },
  },
  port_chat: 0, // random port
  port_mcp: 0,
  scrub_pii: true,
  dev_mode: false,
  log_level: "warn",
};

describe("Foxbridge E2E", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  let sessionStore: SessionStore;


  beforeAll(async () => {
    const localFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("http://localhost:")) return localFetch(input, init);
      if (url === "https://test.atlassian.net/status") return Promise.resolve(new Response("{}", { status: 200 }));
      throw new Error("Unexpected external request in integration test");
    }));
    sessionStore = new SessionStore();
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(createAuthRouter(testConfig, sessionStore));
    app.use(createHealthRouter(testConfig));
    app.use(createChatRouter(testConfig, sessionStore));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr !== "string") {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
    sessionStore.dispose();
    vi.unstubAllGlobals();
  });

  it("healthz returns status", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBeDefined();
    expect(data.ai).toBe("configured");
  });

  it("chat without session returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(401);
  });

  it("login with missing credentials returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("session lifecycle — create, use, destroy", () => {
    const id = sessionStore.create({ user: "test@example.com", token: "tok" });
    expect(sessionStore.get(id)).toBeDefined();

    sessionStore.addMessage(id, { role: "user", content: "hello" });
    expect(sessionStore.get(id)!.messages).toHaveLength(1);

    sessionStore.destroy(id);
    expect(sessionStore.get(id)).toBeUndefined();
  });

  it("logout clears session cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
