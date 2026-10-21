import { Router } from "express";
import type { FoxbridgeConfig } from "@foxbridge/config";
import { createAtlassianFetch, createJiraClient } from "@foxbridge/atlassian";
import type { SessionStore } from "../session.js";

const COOKIE_NAME = "foxbridge_session";

export function createJiraDetailRouter(
  config: FoxbridgeConfig,
  sessionStore: SessionStore,
): Router {
  const router = Router();

  router.get("/api/jira/issue/:key", async (req, res) => {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    const issueKey = req.params.key;
    if (!issueKey || !/^[A-Z][A-Z0-9]+-\d+$/i.test(issueKey)) {
      res.status(400).json({ error: "Invalid issue key" });
      return;
    }

    try {
      const jiraUrl = config.atlassian.jira_url ?? config.atlassian.base_url;
      const atlFetch = createAtlassianFetch(
        jiraUrl,
        config.atlassian.platform,
        session.credentials,
        config.atlassian.auth_method,
      );
      const client = createJiraClient(atlFetch, config.atlassian.platform);

      const [issue, comments] = await Promise.all([
        client.getIssue(issueKey),
        client.getComments(issueKey).catch(() => []),
      ]);

      res.json({ issue, comments });
    } catch (err: any) {
      if (err.message?.includes("failed: 401")) {
        sessionStore.destroy(sessionId);
        res.status(401).json({ error: "Atlassian credentials expired" });
        return;
      }
      if (err.message?.includes("failed: 404")) {
        res.status(404).json({ error: `Issue ${issueKey} not found` });
        return;
      }
      res.status(500).json({ error: "Failed to fetch issue details" });
    }
  });

  return router;
}
