import { Router } from "express";
import type { FoxbridgeConfig } from "@foxbridge/config";
import { createAiProvider } from "../ai-provider.js";

export function createHealthRouter(
  config: FoxbridgeConfig,
): Router {
  const router = Router();

  router.get("/healthz", async (_req, res) => {
    let atlassianStatus = "unknown";
    let aiStatus = "unknown";

    // Check Atlassian connectivity
    try {
      const baseUrl = config.atlassian.base_url.replace(/\/+$/, "");
      const response = await fetch(`${baseUrl}/status`, {
        signal: AbortSignal.timeout(5000),
      });
      atlassianStatus = response.ok ? "ok" : "error";
    } catch {
      atlassianStatus = "error";
    }

    // Check AI provider config
    try {
      const aiProvider = createAiProvider(config.ai);
      aiStatus = aiProvider.provider ? "configured" : "not_configured";
    } catch {
      aiStatus = "not_configured";
    }

    const result: Record<string, unknown> = {
      status: "ok",
      atlassian: atlassianStatus,
      ai: aiStatus,
    };

    res.json(result);
  });

  return router;
}
