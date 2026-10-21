import { randomUUID } from "node:crypto";
import type { UserCredentials } from "@foxbridge/atlassian";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Session {
  id: string;
  credentials: UserCredentials;
  messages: ChatMessage[];
  uploadedFiles: Map<string, UploadedFile>;
  authType: "token" | "oauth";
  oauthTokens?: OAuthTokens;
  createdAt: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_MESSAGES = 200;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SessionStore {
  private sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), CLEANUP_INTERVAL_MS);
  }

  create(credentials: UserCredentials, authType: "token" | "oauth" = "token", oauthTokens?: OAuthTokens): string {
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      credentials,
      messages: [],
      uploadedFiles: new Map(),
      authType,
      oauthTokens,
      createdAt: Date.now(),
    });
    return id;
  }

  updateOAuthTokens(id: string, tokens: OAuthTokens): void {
    const session = this.sessions.get(id);
    if (session) {
      session.oauthTokens = tokens;
      session.credentials = { ...session.credentials, token: tokens.accessToken };
    }
  }

  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  addMessage(id: string, message: ChatMessage): void {
    const session = this.sessions.get(id);
    if (session) {
      session.messages.push(message);
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
  }

  destroy(id: string): void {
    this.sessions.delete(id);
  }

  activeCount(): number {
    const now = Date.now();
    let count = 0;
    for (const session of this.sessions.values()) {
      if (now - session.createdAt <= SESSION_TTL_MS) count++;
    }
    return count;
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
