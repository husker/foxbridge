import { Router } from "express";
import { findConfigPath, writeConfig, configSchema, WIZARD_CONFIG_PATH } from "@foxbridge/config";
import type { FoxbridgeConfig } from "@foxbridge/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Setup wizard API routes. Only active when no config file exists.
 * Guard: all routes return 403 if a config is already found.
 */
export function createSetupRouter(
  gracefulRestart: () => Promise<void>,
): Router {
  const router = Router();

  // Guard: block all setup routes if already configured
  router.use((_req, res, next) => {
    if (findConfigPath() !== null) {
      res.status(403).json({ error: "Already configured" });
      return;
    }
    next();
  });

  router.get("/api/setup/status", (_req, res) => {
    const configPath = findConfigPath();
    res.json({ configured: configPath !== null, configPath });
  });

  router.post("/api/setup/save", (req, res) => {
    try {
      const body = req.body;

      // Build the config object from wizard input
      const config: Record<string, unknown> = {
        atlassian: {
          platform: body.atlassian_platform,
          base_url: body.atlassian_base_url,
          auth_method: body.atlassian_auth_method ?? "pat",
          ...(body.atlassian_jira_url && { jira_url: body.atlassian_jira_url }),
          ...(body.atlassian_confluence_url && { confluence_url: body.atlassian_confluence_url }),
          ...(body.atlassian_bitbucket_url && { bitbucket_url: body.atlassian_bitbucket_url }),
        },
        ai: {
          provider: body.ai_provider,
          ...(body.ai_api_key && { api_key: body.ai_api_key }),
          ...(body.ai_model && { model: body.ai_model }),
          ...(body.ai_base_url && { base_url: body.ai_base_url }),
        },
        features: {
          jira: { read: body.features_jira_read ?? true, write: body.features_jira_write ?? false },
          confluence: { read: body.features_confluence_read ?? true, write: body.features_confluence_write ?? false },
          bitbucket: { read: body.features_bitbucket_read ?? false, write: body.features_bitbucket_write ?? false },
          assets: { read: body.features_assets_read ?? false, write: false },
        },
        ...(body.oauth_client_id && {
          oauth: {
            client_id: body.oauth_client_id,
            client_secret: body.oauth_client_secret,
            callback_url: body.oauth_callback_url,
          },
        }),
      };

      // Validate against schema
      const result = configSchema.safeParse(config);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        res.status(400).json({ error: `Invalid config: ${issues}` });
        return;
      }

      // Ensure the target directory exists
      mkdirSync(dirname(WIZARD_CONFIG_PATH), { recursive: true });

      // Write atomically
      writeConfig(result.data, WIZARD_CONFIG_PATH);

      res.json({ ok: true, configPath: WIZARD_CONFIG_PATH });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Failed to save config" });
    }
  });

  router.post("/api/setup/restart", async (_req, res) => {
    res.json({ ok: true, message: "Restarting..." });
    await gracefulRestart();
  });

  return router;
}
