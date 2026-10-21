import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeConfig } from "./writer.js";
import { loadConfig } from "./loader.js";
import { readFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FoxbridgeConfig } from "./schema.js";

const VALID_CONFIG: FoxbridgeConfig = {
  atlassian: {
    platform: "cloud",
    base_url: "https://myorg.atlassian.net",
    auth_method: "pat",
  },
  ai: {
    provider: "anthropic",
    api_key: "sk-ant-test",
  },
  features: {
    jira: { read: true, write: true },
    confluence: { read: true, write: true },
    bitbucket: { read: false, write: false },
    assets: { read: false, write: false },
  },
  scrub_pii: false,
  dev_mode: false,
  port_chat: 3000,
  port_mcp: 3001,
  log_level: "info",
};

describe("writeConfig", () => {
  const testDir = join(tmpdir(), "foxbridge-writer-test-" + Date.now());

  beforeAll(() => mkdirSync(testDir, { recursive: true }));
  afterAll(() => rmSync(testDir, { recursive: true, force: true }));

  it("writes a valid config and can be read back", () => {
    const path = join(testDir, "roundtrip.yaml");
    writeConfig(VALID_CONFIG, path);

    expect(existsSync(path)).toBe(true);
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);

    // Read back and validate
    const config = loadConfig(path);
    expect(config.atlassian.platform).toBe("cloud");
    expect(config.atlassian.base_url).toBe("https://myorg.atlassian.net");
    expect(config.ai.provider).toBe("anthropic");
    expect(config.ai.api_key).toBe("sk-ant-test");
    expect(config.features.jira.read).toBe(true);
    expect(config.port_chat).toBe(3000);
  });

  it("writes YAML format", () => {
    const path = join(testDir, "format.yaml");
    writeConfig(VALID_CONFIG, path);

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("atlassian:");
    expect(content).toContain("platform: cloud");
    expect(content).toContain("provider: anthropic");
  });

  it("creates temp file in same directory (not /tmp)", () => {
    const path = join(testDir, "samedir.yaml");
    writeConfig(VALID_CONFIG, path);

    // The temp file should have been renamed, so only the final file exists
    expect(existsSync(path)).toBe(true);
    // No .tmp files should remain
    const files = require("node:fs").readdirSync(testDir);
    const tmpFiles = files.filter((f: string) => f.endsWith(".tmp"));
    expect(tmpFiles.length).toBe(0);
  });

  it("handles optional OAuth configuration", () => {
    const configWithOptionals: FoxbridgeConfig = {
      ...VALID_CONFIG,
      oauth: {
        client_id: "test-id",
        client_secret: "test-secret",
        callback_url: "http://localhost:3000/api/auth/callback",
      },
    };
    const path = join(testDir, "optionals.yaml");
    writeConfig(configWithOptionals, path);

    const config = loadConfig(path);
    expect(config.oauth?.client_id).toBe("test-id");
  });
});
