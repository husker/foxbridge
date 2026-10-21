// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  clampSidebarWidth,
  loadSidebarWidth,
  saveSidebarWidth,
} from "./sidebarWidth.js";

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

describe("sidebar width helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    localStorage.clear();
  });

  it("loads the default width when no width has been persisted", () => {
    expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("ignores invalid persisted values", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "wide");

    expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("clamps and saves rounded widths", () => {
    expect(clampSidebarWidth(90)).toBe(180);
    expect(clampSidebarWidth(520)).toBe(420);

    saveSidebarWidth(276.8);

    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("277");
  });
});
