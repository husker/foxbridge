import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import type { FoxbridgeConfig } from "@foxbridge/config";
import type { SessionStore } from "../session.js";
import { createLogger } from "../logger.js";

const COOKIE_NAME = "foxbridge_session";

const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize";
const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

const SCOPES = [
  "read:jira-work", "write:jira-work",
  "read:confluence-content.all", "write:confluence-content.all",
  "offline_access",
].join(" ");

const PENDING_FLOW_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PendingFlow {
  codeVerifier: string;
  createdAt: number;
}

// PKCE helpers
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function createOAuthRouter(
  config: FoxbridgeConfig,
  sessionStore: SessionStore,
): Router {
  const router = Router();
  const log = createLogger(config);
  const pendingFlows = new Map<string, PendingFlow>();

  // Clean up expired pending flows
  setInterval(() => {
    const now = Date.now();
    for (const [state, flow] of pendingFlows) {
      if (now - flow.createdAt > PENDING_FLOW_TTL_MS) {
        pendingFlows.delete(state);
      }
    }
  }, 60_000);

  // Step 1: Start OAuth flow — redirect user to Atlassian
  router.get("/api/auth/atlassian", (_req, res) => {
    if (!config.oauth) {
      res.status(404).json({ error: "OAuth not configured" });
      return;
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pendingFlows.set(state, { codeVerifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: config.oauth.client_id,
      scope: SCOPES,
      redirect_uri: config.oauth.callback_url,
      state,
      response_type: "code",
      prompt: "consent",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    log("debug", "Starting OAuth flow", { state });
    res.redirect(`${ATLASSIAN_AUTH_URL}?${params.toString()}`);
  });

  // Step 2: Handle callback — exchange code for tokens
  router.get("/api/auth/callback", async (req, res) => {
    try {
      if (!config.oauth) {
        res.status(404).json({ error: "OAuth not configured" });
        return;
      }

      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const error = req.query.error as string | undefined;

      if (error) {
        log("warn", `OAuth error: ${error}`);
        res.redirect("/?error=oauth_denied");
        return;
      }

      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }

      const pending = pendingFlows.get(state);
      if (!pending) {
        res.status(400).json({ error: "Invalid or expired state" });
        return;
      }
      pendingFlows.delete(state);

      // Exchange code for tokens
      const tokenRes = await fetch(ATLASSIAN_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: config.oauth.client_id,
          client_secret: config.oauth.client_secret,
          code,
          redirect_uri: config.oauth.callback_url,
          code_verifier: pending.codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        log("error", `Token exchange failed: ${tokenRes.status}`);
        res.redirect("/?error=token_exchange_failed");
        return;
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
      };

      // Fetch accessible resources to get user identity and cloud ID
      const resourcesRes = await fetch(ATLASSIAN_RESOURCES_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!resourcesRes.ok) {
        log("error", `Failed to fetch accessible resources: ${resourcesRes.status}`);
        res.redirect("/?error=resources_failed");
        return;
      }

      const resources = await resourcesRes.json() as Array<{
        id: string;
        name: string;
        url: string;
        scopes: string[];
      }>;

      if (resources.length === 0) {
        res.redirect("/?error=no_accessible_sites");
        return;
      }

      // Use the first accessible site (or match config base_url)
      const site = resources.find((r) => config.atlassian.base_url.includes(r.url)) ?? resources[0];

      // Fetch the user's identity
      const meRes = await fetch(`https://api.atlassian.com/ex/jira/${site.id}/rest/api/3/myself`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let userEmail = "unknown";
      if (meRes.ok) {
        const me = await meRes.json() as { emailAddress?: string; displayName?: string };
        userEmail = me.emailAddress ?? me.displayName ?? "unknown";
      }

      // Create session
      const sessionId = sessionStore.create(
        { user: userEmail, token: tokens.access_token },
        "oauth",
        {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        },
      );

      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: !config.dev_mode,
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60 * 1000,
      });

      log("info", `OAuth login: ${userEmail} via ${site.name}`);
      res.redirect("/");
    } catch (err: any) {
      log("error", `OAuth callback error: ${err.message}`);
      res.redirect("/?error=oauth_failed");
    }
  });

  return router;
}
