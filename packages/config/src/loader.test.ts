import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadConfig } from "./loader.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  const testDir = join(tmpdir(), "foxbridge-test-" + Date.now());

  beforeAll(() => mkdirSync(testDir, { recursive: true }));
  afterAll(() => rmSync(testDir, { recursive: true, force: true }));

  it("loads and validates a valid YAML config", () => {
    const configPath = join(testDir, "valid.yaml");
    writeFileSync(
      configPath,
      `
atlassian:
  platform: cloud
  base_url: https://myorg.atlassian.net
ai:
  provider: anthropic
  api_key: sk-ant-test
features:
  jira:
    read: true
    write: true
  confluence:
    read: true
    write: true
  bitbucket:
    read: true
    write: true
`
    );
    const config = loadConfig(configPath);
    expect(config.atlassian.platform).toBe("cloud");
    expect(config.atlassian.base_url).toBe("https://myorg.atlassian.net");
    expect(config.ai.provider).toBe("anthropic");
    expect(config.scrub_pii).toBe(false);
    expect(config.port_chat).toBe(3000);
  });

  it("throws on missing file", () => {
    expect(() => loadConfig("/nonexistent/config.yaml")).toThrow();
  });

  it("throws on invalid YAML content", () => {
    const configPath = join(testDir, "invalid.yaml");
    writeFileSync(configPath, "atlassian:\n  platform: server\n  base_url: not-a-url\n");
    expect(() => loadConfig(configPath)).toThrow();
  });
});
