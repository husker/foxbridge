import { describe, it, expect, vi, afterEach } from "vitest";
import { extractCredentials, McpSessionCache } from "./http.js";

describe("extractCredentials", () => {
  it("extracts credentials from X-Foxbridge headers", () => {
    const headers = new Headers({
      "X-Foxbridge-User": "user@example.com",
      "X-Foxbridge-Token": "api-token-123",
    });
    const creds = extractCredentials(headers);
    expect(creds).toEqual({ user: "user@example.com", token: "api-token-123" });
  });

  it("throws when headers are missing", () => {
    expect(() => extractCredentials(new Headers())).toThrow("Missing authentication");
  });

  it("throws when only user is provided", () => {
    const headers = new Headers({ "X-Foxbridge-User": "user@example.com" });
    expect(() => extractCredentials(headers)).toThrow("Missing authentication");
  });

  it("throws when only token is provided", () => {
    const headers = new Headers({ "X-Foxbridge-Token": "api-token-123" });
    expect(() => extractCredentials(headers)).toThrow("Missing authentication");
  });
});

describe("McpSessionCache", () => {
  const creds = { user: "alice@example.com", token: "tok-1" };
  const creds2 = { user: "bob@example.com", token: "tok-2" };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a value on first request", () => {
    const factory = vi.fn((c) => ({ id: c.user }));
    const cache = new McpSessionCache(factory);
    try {
      const value = cache.get("s1", creds);
      expect(value).toEqual({ id: "alice@example.com" });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith(creds);
    } finally {
      cache.dispose();
    }
  });

  it("reuses value for same session", () => {
    const factory = vi.fn((c) => ({ id: c.user }));
    const cache = new McpSessionCache(factory);
    try {
      const v1 = cache.get("s1", creds);
      const v2 = cache.get("s1", creds);
      expect(v1).toBe(v2);
      expect(factory).toHaveBeenCalledTimes(1);
    } finally {
      cache.dispose();
    }
  });

  it("never reuses credentials when the same session ID is supplied with a different token", () => {
    const factory = vi.fn((c) => ({ user: c.user, token: c.token }));
    const cache = new McpSessionCache(factory);
    try {
      const original = cache.get("shared-user", creds);
      const other = cache.get("shared-user", { ...creds, token: "different-token" });
      expect(other).not.toBe(original);
      expect(other.token).toBe("different-token");
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      cache.dispose();
    }
  });

  it("creates separate values for different sessions", () => {
    const factory = vi.fn((c) => ({ id: c.user }));
    const cache = new McpSessionCache(factory);
    try {
      const v1 = cache.get("s1", creds);
      const v2 = cache.get("s2", creds2);
      expect(v1).not.toBe(v2);
      expect(v1).toEqual({ id: "alice@example.com" });
      expect(v2).toEqual({ id: "bob@example.com" });
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      cache.dispose();
    }
  });

  it("evicts expired sessions", () => {
    vi.useFakeTimers();
    const factory = vi.fn((c) => ({ id: c.user }));
    const cache = new McpSessionCache(factory);
    try {
      const v1 = cache.get("s1", creds);
      // Advance past the 8-hour TTL
      vi.advanceTimersByTime(8 * 60 * 60 * 1000);
      const v2 = cache.get("s1", creds);
      expect(v2).not.toBe(v1);
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      cache.dispose();
    }
  });

  it("destroy removes a session", () => {
    const factory = vi.fn((c) => ({ id: c.user }));
    const cache = new McpSessionCache(factory);
    try {
      const v1 = cache.get("s1", creds);
      cache.destroy("s1");
      const v2 = cache.get("s1", creds);
      expect(v2).not.toBe(v1);
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      cache.dispose();
    }
  });
});
