import { Router } from "express";
import type { FoxbridgeConfig } from "@foxbridge/config";

export function createFeaturesRouter(config: FoxbridgeConfig): Router {
  const router = Router();

  router.get("/api/config/features", (_req, res) => {
    res.json({
      jira: config.features.jira,
      confluence: config.features.confluence,
      bitbucket: config.features.bitbucket,
      atlassian_base_url: config.atlassian.browse_url ?? config.atlassian.jira_url ?? config.atlassian.base_url,
      atlassian_platform: config.atlassian.platform,
      oauth_enabled: !!config.oauth,
    });
  });

  return router;
}
