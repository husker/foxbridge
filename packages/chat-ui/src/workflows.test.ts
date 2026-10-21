// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWorkflow,
  deleteWorkflow,
  DEFAULT_WORKFLOWS,
  loadWorkflows,
  saveCustomWorkflows,
  WORKFLOWS_KEY,
} from "./workflows.js";

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

describe("workflow storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
    vi.setSystemTime(new Date("2026-05-29T19:00:00.000Z"));
  });

  it("loads default workflows when no custom workflows exist", () => {
    const workflows = loadWorkflows();

    expect(workflows.map((workflow) => workflow.name)).toContain("Morning triage");
    expect(workflows.every((workflow) => workflow.source === "default")).toBe(true);
  });

  it("adds and persists custom workflows after defaults", () => {
    const workflows = addWorkflow(DEFAULT_WORKFLOWS, {
      name: "Release notes",
      prompt: "Summarize release notes from the current sprint",
    });

    saveCustomWorkflows(workflows);
    const loaded = loadWorkflows();

    expect(loaded[0].source).toBe("default");
    expect(loaded.some((workflow) => workflow.name === "Release notes" && workflow.source === "custom")).toBe(true);
    expect(localStorage.getItem(WORKFLOWS_KEY)).toContain("Release notes");
  });

  it("does not delete default workflows", () => {
    const workflows = deleteWorkflow(loadWorkflows(), DEFAULT_WORKFLOWS[0].id);

    expect(workflows.some((workflow) => workflow.id === DEFAULT_WORKFLOWS[0].id)).toBe(true);
  });
});
