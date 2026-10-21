import { describe, it, expect } from "vitest";
import { isCloudUrl } from "./platform.js";

describe("isCloudUrl", () => {
  it("detects Atlassian Cloud URLs", () => {
    expect(isCloudUrl("https://myorg.atlassian.net")).toBe(true);
    expect(isCloudUrl("https://myorg.atlassian.net/")).toBe(true);
  });

  it("detects Data Center URLs", () => {
    expect(isCloudUrl("https://jira.internal.example.com")).toBe(false);
    expect(isCloudUrl("https://10.0.0.1:8080")).toBe(false);
  });

  it("detects Bitbucket Cloud", () => {
    expect(isCloudUrl("https://bitbucket.org")).toBe(true);
    expect(isCloudUrl("https://api.bitbucket.org")).toBe(true);
  });
});
