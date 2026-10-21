import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("@foxbridge/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@foxbridge/config")>();
  return {
    ...actual,
    findConfigPath: () => "/test/foxbridge.yaml",
    loadConfig: () => ({
      ...actual.configSchema.parse({
        atlassian: { platform: "datacenter", base_url: "https://jira.example.com" },
        ai: { provider: "ollama" },
        features: {
          jira: { read: true, write: false },
          confluence: { read: false, write: false },
          bitbucket: { read: false, write: false },
        },
        log_level: "error",
      }),
      port_chat: 0,
      port_mcp: 0,
    }),
  };
});

import { startServer } from "./index.js";

describe("standalone server startup", () => {
  let servers: Server[];
  let chatUrl: string;
  let mcpUrl: string;
  const upstreamAuth: string[] = [];

  beforeAll(async () => {
    const localFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === "https://jira.example.com/rest/api/2/search") {
        upstreamAuth.push(new Headers(init?.headers).get("Authorization") ?? "");
        return Promise.resolve(new Response(JSON.stringify({ issues: [], total: 0, maxResults: 50, startAt: 0 })));
      }
      if (!String(input).startsWith("http://127.0.0.1:")) {
        throw new Error("Startup must not call an external service");
      }
      return localFetch(input, init);
    }));
    servers = await startServer();
    await Promise.all(servers.map((server) => server.listening
      ? Promise.resolve()
      : new Promise<void>((resolve) => server.once("listening", resolve))));
    [chatUrl, mcpUrl] = servers.map((s) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`);
  });

  afterAll(async () => {
    await Promise.all((servers ?? []).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    vi.unstubAllGlobals();
  });

  it("starts with ordinary configuration and no outbound validation call", async () => {
    const res = await fetch(`${chatUrl}/api/setup/status`);
    expect(res.status).toBe(200);
    expect((await res.json()).configured).toBe(true);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith("http://127.0.0.1:"))).toBe(true);
  });

  it("still rejects unauthenticated chat requests", async () => {
    const res = await fetch(`${chatUrl}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(401);
  });

  it("still rejects MCP requests without Atlassian credentials", async () => {
    const res = await fetch(`${mcpUrl}/mcp`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toContain("Missing authentication");
  });

  it("handles repeated MCP requests with independent credentials and read-only tools", async () => {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Foxbridge-User": "alex@example.com",
      "X-Foxbridge-Token": "fixture-first-token",
    };
    for (const id of [1, 2]) {
      const res = await fetch(`${mcpUrl}/mcp`, {
        method: "POST", headers,
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" }),
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("jira_search_issues");
      expect(body).not.toContain("jira_create_issue");
    }
    for (const token of ["fixture-first-token", "fixture-second-token"]) {
      const res = await fetch(`${mcpUrl}/mcp`, {
        method: "POST", headers: { ...headers, "X-Foxbridge-Token": token },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: {
          name: "jira_search_issues", arguments: { jql: "project = DEMO" },
        } }),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain('"isError":true');
    }
    expect(upstreamAuth).toEqual(["Bearer fixture-first-token", "Bearer fixture-second-token"]);
  });
});
