import { Router } from "express";
import type { FoxbridgeConfig } from "@foxbridge/config";
import type { SessionStore } from "../session.js";

const COOKIE_NAME = "foxbridge_session";

export function createAuthRouter(
  config: FoxbridgeConfig,
  sessionStore: SessionStore,
): Router {
  const router = Router();

  router.post("/api/auth/login", async (req, res) => {
    try {
      const { user, token } = req.body as { user?: string; token?: string };

      if (!user || !token) {
        res.status(400).json({ error: "Missing user or token" });
        return;
      }

      // Validate credentials against Atlassian
      const apiPath =
        config.atlassian.platform === "cloud"
          ? "/rest/api/3/myself"
          : "/rest/api/2/myself";
      const baseUrl = (config.atlassian.jira_url ?? config.atlassian.base_url).replace(/\/+$/, "");
      const url = `${baseUrl}${apiPath}`;

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      const useBasic = config.atlassian.platform === "cloud" || config.atlassian.auth_method === "basic";
      if (useBasic) {
        const encoded = Buffer.from(`${user}:${token}`).toString("base64");
        headers["Authorization"] = `Basic ${encoded}`;
      } else {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        res.status(401).json({ error: "Invalid Atlassian credentials" });
        return;
      }

      const sessionId = sessionStore.create({ user, token });

      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: !config.dev_mode,
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60 * 1000, // 8 hours (match session TTL)
      });

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Login failed" });
    }
  });

  router.get("/api/auth/session", (req, res) => {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    const session = sessionId ? sessionStore.get(sessionId) : undefined;
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user: session.credentials.user });
  });

  router.post("/api/auth/logout", (req, res) => {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (sessionId) {
      sessionStore.destroy(sessionId);
    }
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  return router;
}

export { COOKIE_NAME };
