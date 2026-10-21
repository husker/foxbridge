import { createHash } from "node:crypto";
import type { UserCredentials } from "@foxbridge/atlassian";

export function extractCredentials(headers: Headers): UserCredentials {
  const user = headers.get("X-Foxbridge-User");
  const token = headers.get("X-Foxbridge-Token");
  if (!user || !token) {
    throw new Error("Missing authentication: X-Foxbridge-User and X-Foxbridge-Token headers required");
  }
  return { user, token };
}

const TTL_MS = 8 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface CachedEntry<T> {
  value: T;
  createdAt: number;
  credentialFingerprint: string;
}

export class McpSessionCache<T> {
  private cache = new Map<string, CachedEntry<T>>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private factory: (credentials: UserCredentials) => T) {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  has(sessionId: string): boolean {
    const existing = this.cache.get(sessionId);
    return !!existing && Date.now() - existing.createdAt < TTL_MS;
  }

  get(sessionId: string, credentials: UserCredentials): T {
    // A caller-supplied user/session ID must never reuse another caller's credentials.
    const credentialFingerprint = createHash("sha256")
      .update(JSON.stringify([credentials.user, credentials.token]))
      .digest("hex");
    const existing = this.cache.get(sessionId);
    if (existing && existing.credentialFingerprint === credentialFingerprint && Date.now() - existing.createdAt < TTL_MS) {
      return existing.value;
    }
    const value = this.factory(credentials);
    this.cache.set(sessionId, { value, createdAt: Date.now(), credentialFingerprint });
    return value;
  }

  destroy(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  activeCount(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.cache.values()) {
      if (now - entry.createdAt < TTL_MS) count++;
    }
    return count;
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (now - entry.createdAt >= TTL_MS) this.cache.delete(id);
    }
  }
}
