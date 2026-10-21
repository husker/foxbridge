import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./oauth.js";
import { createHash } from "node:crypto";

describe("OAuth PKCE utilities", () => {
  it("generates code verifier with valid length and charset", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates correct S256 code challenge from verifier", () => {
    const verifier = "test-verifier-string";
    const challenge = generateCodeChallenge(verifier);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("generates unique state parameters", () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });

  it("generates state as 32-char hex string", () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });
});
