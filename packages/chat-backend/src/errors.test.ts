import { describe, it, expect } from "vitest";
import { classifyError } from "./errors.js";

describe("classifyError", () => {
  it("classifies rate limit errors", () => {
    const err = Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    const result = classifyError(err);
    expect(result.userMessage).toContain("busy");
    expect(result.shouldInvalidateSession).toBe(false);
  });

  it("classifies AI auth errors", () => {
    const err = Object.assign(new Error("Invalid API key"), { status: 401 });
    const result = classifyError(err);
    expect(result.userMessage).toContain("configuration");
    expect(result.shouldInvalidateSession).toBe(false);
  });

  it("classifies Atlassian 401 as session invalidation", () => {
    const err = new Error("Jira search failed: 401 Unauthorized");
    const result = classifyError(err);
    expect(result.userMessage).toContain("expired");
    expect(result.shouldInvalidateSession).toBe(true);
  });

  it("classifies network errors", () => {
    const err = new Error("fetch failed: ECONNREFUSED");
    const result = classifyError(err);
    expect(result.userMessage).toContain("unavailable");
  });

  it("classifies tool loop exhaustion", () => {
    const err = new Error("Maximum tool calls exceeded");
    const result = classifyError(err);
    expect(result.userMessage).toContain("Maximum tool calls");
  });

  it("returns generic message for unknown errors", () => {
    const result = classifyError(new Error("something weird"));
    expect(result.userMessage).toContain("went wrong");
    expect(result.logLevel).toBe("error");
  });

  it("handles non-Error objects", () => {
    const result = classifyError("string error");
    expect(result.userMessage).toContain("went wrong");
  });
});
