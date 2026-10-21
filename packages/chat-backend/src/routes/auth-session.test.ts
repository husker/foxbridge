import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createAuthRouter, COOKIE_NAME } from "./auth.js";
import { SessionStore } from "../session.js";

const config = {
  atlassian: { platform: "datacenter", base_url: "http://unused.invalid", auth_method: "basic" },
  ai: { provider: "anthropic", api_key: "test" },
  features: { jira: { read: true, write: false } },
  dev_mode: true,
} as any;


describe("GET /api/auth/session", () => {
  let server: Server;
  let base: string;
  const sessionStore = new SessionStore();

  beforeAll(async () => {
    const localFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === "http://unused.invalid/rest/api/2/myself") {
        const valid = new Headers(init?.headers).get("Authorization") ===
          `Basic ${Buffer.from("alex:fixture-valid-token").toString("base64")}`;
        return Promise.resolve(new Response("{}", { status: valid ? 200 : 401 }));
      }
      if (!String(input).startsWith("http://127.0.0.1:")) throw new Error("Unexpected external call");
      return localFetch(input, init);
    }));
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(createAuthRouter(config, sessionStore));
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
    sessionStore.dispose();
    vi.unstubAllGlobals();
  });

  it("accepts valid Atlassian credentials with no commercial seat limit", async () => {
    for (let i = 0; i < 120; i++) sessionStore.create({ user: `fixture-${i}`, token: "fixture-token" });
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "alex", token: "fixture-valid-token" }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const check = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie.split(";")[0] } });
    expect(await check.json()).toEqual({ authenticated: true, user: "alex" });
  });

  it("still rejects invalid Atlassian credentials", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "alex", token: "fixture-invalid-token" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("reports unauthenticated without a session cookie", async () => {
    const res = await fetch(`${base}/api/auth/session`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it("reports unauthenticated for an unknown session id", async () => {
    const res = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: `${COOKIE_NAME}=not-a-real-session` },
    });
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it("reports the user for a live session", async () => {
    const id = sessionStore.create({ user: "fielduser", token: "secret" });
    const res = await fetch(`${base}/api/auth/session`, {
      headers: { Cookie: `${COOKIE_NAME}=${id}` },
    });
    expect(await res.json()).toEqual({ authenticated: true, user: "fielduser" });
  });
});
