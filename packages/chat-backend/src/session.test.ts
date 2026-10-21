import { describe, it, expect, vi, afterEach } from "vitest";
import { SessionStore } from "./session.js";
import type { UserCredentials } from "@foxbridge/atlassian";

const creds: UserCredentials = { user: "alice@example.com", token: "tok-123" };

describe("SessionStore", () => {
  let store: SessionStore;

  afterEach(() => {
    store?.dispose();
  });

  it("creates a session and returns an id", () => {
    store = new SessionStore();
    const id = store.create(creds);
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
  });

  it("retrieves a created session", () => {
    store = new SessionStore();
    const id = store.create(creds);
    const session = store.get(id);
    expect(session).toBeDefined();
    expect(session!.id).toBe(id);
    expect(session!.credentials).toEqual(creds);
    expect(session!.messages).toEqual([]);
    expect(session!.createdAt).toBeGreaterThan(0);
  });

  it("returns undefined for unknown session id", () => {
    store = new SessionStore();
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("adds messages to a session", () => {
    store = new SessionStore();
    const id = store.create(creds);
    store.addMessage(id, { role: "user", content: "Hello" });
    store.addMessage(id, { role: "assistant", content: "Hi there" });
    const session = store.get(id);
    expect(session!.messages).toHaveLength(2);
    expect(session!.messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(session!.messages[1]).toEqual({
      role: "assistant",
      content: "Hi there",
    });
  });

  it("ignores addMessage for unknown session", () => {
    store = new SessionStore();
    // Should not throw
    store.addMessage("nonexistent", { role: "user", content: "Hello" });
  });

  it("destroys a session", () => {
    store = new SessionStore();
    const id = store.create(creds);
    expect(store.get(id)).toBeDefined();
    store.destroy(id);
    expect(store.get(id)).toBeUndefined();
  });

  it("creates unique session ids", () => {
    store = new SessionStore();
    const id1 = store.create(creds);
    const id2 = store.create(creds);
    expect(id1).not.toBe(id2);
  });
});

describe("SessionStore TTL", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for expired sessions (past 8 hours)", () => {
    vi.useFakeTimers();
    const store = new SessionStore();
    const id = store.create(creds);
    expect(store.get(id)).toBeDefined();

    // Advance 9 hours
    vi.advanceTimersByTime(9 * 60 * 60 * 1000);
    expect(store.get(id)).toBeUndefined();

    store.dispose();
  });

  it("returns session within TTL (7 hours)", () => {
    vi.useFakeTimers();
    const store = new SessionStore();
    const id = store.create(creds);

    // Advance 7 hours (within 8-hour TTL)
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    expect(store.get(id)).toBeDefined();

    store.dispose();
  });
});

describe("SessionStore max messages", () => {
  let store: SessionStore;

  afterEach(() => {
    store?.dispose();
  });

  it("caps messages at 200, dropping oldest", () => {
    store = new SessionStore();
    const id = store.create(creds);

    for (let i = 0; i < 210; i++) {
      store.addMessage(id, { role: "user", content: `msg-${i}` });
    }

    const session = store.get(id);
    expect(session!.messages).toHaveLength(200);
    // Oldest messages (0-9) should be dropped
    expect(session!.messages[0].content).toBe("msg-10");
    expect(session!.messages[199].content).toBe("msg-209");
  });
});
