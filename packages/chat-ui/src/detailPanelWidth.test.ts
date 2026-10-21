// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DETAIL_PANEL_WIDTH,
  DETAIL_PANEL_WIDTH_STORAGE_KEY,
  clampDetailPanelWidth,
  loadDetailPanelWidth,
  saveDetailPanelWidth,
} from "./detailPanelWidth.js";

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

describe("detail panel width helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads the default width when no width has been persisted", () => {
    expect(loadDetailPanelWidth()).toBe(DEFAULT_DETAIL_PANEL_WIDTH);
  });

  it("ignores invalid persisted values", () => {
    localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, "wide");

    expect(loadDetailPanelWidth()).toBe(DEFAULT_DETAIL_PANEL_WIDTH);
  });

  it("clamps persisted values to the supported range", () => {
    localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, "900");
    expect(loadDetailPanelWidth()).toBe(640);

    localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, "120");
    expect(loadDetailPanelWidth()).toBe(280);
  });

  it("saves rounded widths", () => {
    saveDetailPanelWidth(412.8);

    expect(localStorage.getItem(DETAIL_PANEL_WIDTH_STORAGE_KEY)).toBe("413");
  });

  it("respects the available viewport width", () => {
    expect(clampDetailPanelWidth(640, 900)).toBe(540);
  });
});
