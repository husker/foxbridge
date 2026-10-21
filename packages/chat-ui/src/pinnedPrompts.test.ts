// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissStarterPrompt,
  loadDismissedStarterPrompts,
  loadPinnedPrompts,
  pinPrompt,
  saveDismissedStarterPrompts,
  savePinnedPrompts,
  togglePinnedPrompt,
} from "./pinnedPrompts.js";

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

describe("pinned prompt storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    localStorage.clear();
  });

  it("pins trimmed prompts newest-first without duplicates", () => {
    const pinned = pinPrompt(["Existing prompt"], "  New reusable prompt  ");

    expect(pinned).toEqual(["New reusable prompt", "Existing prompt"]);
    expect(pinPrompt(pinned, "New reusable prompt")).toEqual(pinned);
    expect(pinPrompt(pinned, "   ")).toEqual(pinned);
  });

  it("toggles prompts on and off", () => {
    expect(togglePinnedPrompt([], "Find my blockers")).toEqual(["Find my blockers"]);
    expect(togglePinnedPrompt(["Find my blockers"], "Find my blockers")).toEqual([]);
  });

  it("round-trips pinned and dismissed starter prompts through localStorage", () => {
    savePinnedPrompts(["Prompt one"]);
    saveDismissedStarterPrompts(["Starter one"]);

    expect(loadPinnedPrompts()).toEqual(["Prompt one"]);
    expect(loadDismissedStarterPrompts()).toEqual(["Starter one"]);
    expect(dismissStarterPrompt([], "Starter one")).toEqual(["Starter one"]);
  });
});
