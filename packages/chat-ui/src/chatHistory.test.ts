// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "./types.js";
import {
  CHAT_CONVERSATIONS_KEY,
  deleteConversation,
  loadConversations,
  saveConversations,
  summarizeConversation,
  upsertConversation,
} from "./chatHistory.js";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("chat history storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    vi.setSystemTime(new Date("2026-05-29T19:00:00.000Z"));
  });

  it("summarizes a conversation from the first user prompt", () => {
    const messages: ChatMessage[] = [
      { role: "assistant", content: "Hello" },
      { role: "user", content: "  Show my open issues assigned to me, sorted by priority  " },
    ];

    expect(summarizeConversation(messages)).toBe("Show my open issues assigned to me, sorted by priority");
  });

  it("upserts conversations newest-first and persists without file bytes", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Summarize this document" },
      { role: "assistant", content: "Done" },
    ];

    const next = upsertConversation([], "conv-1", messages);
    saveConversations(next);

    expect(next[0]).toMatchObject({
      id: "conv-1",
      title: "Summarize this document",
      messages,
      createdAt: "2026-05-29T19:00:00.000Z",
      updatedAt: "2026-05-29T19:00:00.000Z",
    });
    expect(loadConversations()).toEqual(next);
    expect(localStorage.getItem(CHAT_CONVERSATIONS_KEY)).not.toContain("ArrayBuffer");
  });

  it("deletes conversations by id", () => {
    const conversations = [
      upsertConversation([], "conv-1", [{ role: "user", content: "One" }])[0],
      upsertConversation([], "conv-2", [{ role: "user", content: "Two" }])[0],
    ];

    expect(deleteConversation(conversations, "conv-1").map((item) => item.id)).toEqual(["conv-2"]);
  });
});
