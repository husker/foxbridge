import { describe, it, expect } from "vitest";
import { configSchema } from "./schema.js";

describe("configSchema", () => {
  it("accepts a valid complete config", () => {
    const valid = {
      atlassian: {
        platform: "cloud",
        base_url: "https://myorg.atlassian.net",
      },
      ai: {
        provider: "anthropic",
        api_key: "sk-ant-test",
      },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: false },
        bitbucket: { read: false, write: false },
      },
      scrub_pii: false,
    };
    const result = configSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("applies defaults for optional fields", () => {
    const minimal = {
      atlassian: {
        platform: "datacenter",
        base_url: "https://jira.internal.example.com",
      },
      ai: {
        provider: "ollama",
      },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    };
    const result = configSchema.parse(minimal);
    expect(result.scrub_pii).toBe(false);
    expect(result.dev_mode).toBe(false);
    expect(result.port_chat).toBe(3000);
    expect(result.port_mcp).toBe(3001);
    expect(result.log_level).toBe("info");
  });

  it("defaults dev_mode to false", () => {
    const minimal = {
      atlassian: {
        platform: "cloud",
        base_url: "https://myorg.atlassian.net",
      },
      ai: {
        provider: "anthropic",
      },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    };
    const result = configSchema.parse(minimal);
    expect(result.dev_mode).toBe(false);
  });

  it("rejects invalid platform", () => {
    const invalid = {
      atlassian: { platform: "server", base_url: "https://example.com" },
      ai: { provider: "anthropic" },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing atlassian base_url", () => {
    const invalid = {
      atlassian: { platform: "cloud" },
      ai: { provider: "anthropic" },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts optional oauth config", () => {
    const config = configSchema.parse({
      atlassian: { platform: "cloud", base_url: "https://myorg.atlassian.net" },
      ai: { provider: "anthropic" },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
      oauth: {
        client_id: "my-client-id",
        client_secret: "my-secret",
        callback_url: "https://foxbridge.example.com/api/auth/callback",
      },
    });
    expect(config.oauth?.client_id).toBe("my-client-id");
  });

  it("allows missing oauth config", () => {
    const config = configSchema.parse({
      atlassian: { platform: "cloud", base_url: "https://myorg.atlassian.net" },
      ai: { provider: "anthropic" },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    });
    expect(config.oauth).toBeUndefined();
  });

  it("rejects invalid AI provider", () => {
    const invalid = {
      atlassian: { platform: "cloud", base_url: "https://x.atlassian.net" },
      ai: { provider: "gemini" },
      features: {
        jira: { read: true, write: true },
        confluence: { read: true, write: true },
        bitbucket: { read: true, write: true },
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
