import { describe, it, expect, vi } from "vitest";
import { createAtlassianFetch } from "./http-client.js";
import type { UserCredentials } from "./types.js";

describe("createAtlassianFetch", () => {
  it("adds Basic auth header for cloud platform", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = mockFetch;

    const creds: UserCredentials = { user: "user@example.com", token: "api-token" };
    const atlFetch = createAtlassianFetch("https://myorg.atlassian.net", "cloud", creds);

    await atlFetch("/rest/api/3/myself");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://myorg.atlassian.net/rest/api/3/myself");
    const authHeader = (init.headers as Headers).get("Authorization");
    const expected = "Basic " + Buffer.from("user@example.com:api-token").toString("base64");
    expect(authHeader).toBe(expected);
  });

  it("adds Bearer auth header for datacenter platform", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = mockFetch;

    const creds: UserCredentials = { user: "admin", token: "pat-token" };
    const atlFetch = createAtlassianFetch("https://jira.internal.com", "datacenter", creds);

    await atlFetch("/rest/api/2/myself");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://jira.internal.com/rest/api/2/myself");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer pat-token");
  });
});
