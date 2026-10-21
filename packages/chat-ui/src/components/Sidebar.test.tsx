// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar.js";
import type { FeatureConfig } from "../types.js";

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

const features: FeatureConfig = {
  jira: { read: true, write: false },
  confluence: { read: true, write: false },
  bitbucket: { read: true, write: false },
};

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    features,
    recentItems: [],
    sessionFiles: [],
    pinnedPrompts: [],
    workflows: [],
    conversations: [],
    activeConversationId: null,
    onTogglePinnedPrompt: vi.fn(),
    onSendPrompt: vi.fn(),
    onNewConversation: vi.fn(),
    onSelectConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onAddWorkflow: vi.fn(),
    onDeleteWorkflow: vi.fn(),
    onSelectItem: vi.fn(),
    onFileClick: vi.fn(),
    activeDetailKey: null,
    theme: "light" as const,
    onToggleTheme: vi.fn(),
    userName: "alex@example.com",
    onLogout: vi.fn(),
    onCollapse: vi.fn(),
    ...overrides,
  };

  render(<Sidebar {...props} />);
  return props;
}

describe("Sidebar pinned prompts", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
  });

  it("renders user pinned prompts and lets them be sent or unpinned", () => {
    const props = renderSidebar({
      pinnedPrompts: ["Summarize my blockers"],
    });

    fireEvent.click(screen.getByText("Summarize my blockers"));
    fireEvent.click(screen.getByTitle("Unpin prompt"));

    expect(screen.getByText("Pinned Prompts")).toBeTruthy();
    expect(props.onSendPrompt).toHaveBeenCalledWith("Summarize my blockers");
    expect(props.onTogglePinnedPrompt).toHaveBeenCalledWith("Summarize my blockers");
  });

  it("shows only two dismissible starter prompts", () => {
    renderSidebar();

    expect(screen.getAllByTitle("Dismiss starter prompt")).toHaveLength(2);
    expect(screen.queryByText("List unresolved bugs from the last 30 days across all projects")).toBeNull();

    fireEvent.click(screen.getAllByTitle("Dismiss starter prompt")[0]);

    expect(screen.getAllByTitle("Dismiss starter prompt")).toHaveLength(1);
  });

  it("keeps pinned prompts, workflows, and recent conversations in separate collapsible sections", () => {
    const props = renderSidebar({
      pinnedPrompts: ["Summarize blockers"],
      workflows: [
        {
          id: "wf-1",
          name: "Morning triage",
          description: "Open issues",
          prompt: "Show my open issues",
          source: "default",
        },
      ],
      conversations: [
        {
          id: "conv-1",
          title: "Yesterday's release notes",
          messages: [{ role: "user", content: "Yesterday's release notes" }],
          createdAt: "2026-05-29T18:00:00.000Z",
          updatedAt: "2026-05-29T18:00:00.000Z",
        },
      ],
    });

    fireEvent.click(screen.getByText("Morning triage"));
    fireEvent.click(screen.getByText("Yesterday's release notes"));
    fireEvent.click(screen.getByTitle("Collapse Pinned Prompts"));

    expect(screen.getByText("Workflows")).toBeTruthy();
    expect(screen.getByText("Recent Conversations")).toBeTruthy();
    expect(props.onSendPrompt).toHaveBeenCalledWith("Show my open issues");
    expect(props.onSelectConversation).toHaveBeenCalledWith("conv-1");
    expect(screen.queryByText("Summarize blockers")).toBeNull();
  });

  it("uses larger section arrows for collapse and expand controls", () => {
    renderSidebar();

    const arrow = screen.getByTitle("Collapse Pinned Prompts").querySelector("[aria-hidden='true']");

    expect(arrow).not.toBeNull();
    expect((arrow as HTMLElement).style.fontSize).toBe("14px");
    expect((arrow as HTMLElement).style.width).toBe("16px");
  });

  it("lets the sidebar be resized by dragging its right edge", () => {
    const onWidthChange = vi.fn();
    renderSidebar({
      width: 220,
      onWidthChange,
    } as Partial<Parameters<typeof Sidebar>[0]>);

    fireEvent.pointerDown(screen.getByLabelText("Resize sidebar"), { clientX: 220 });
    fireEvent.pointerMove(window, { clientX: 280 });
    fireEvent.pointerUp(window);

    expect(onWidthChange).toHaveBeenCalledWith(280);
  });

  it("adds a custom workflow from the inline form", () => {
    const props = renderSidebar();

    fireEvent.click(screen.getByTitle("Add workflow"));
    fireEvent.change(screen.getByPlaceholderText("Workflow name"), { target: { value: "Release notes" } });
    fireEvent.change(screen.getByPlaceholderText("Workflow prompt"), { target: { value: "Summarize release notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onAddWorkflow).toHaveBeenCalledWith({
      name: "Release notes",
      prompt: "Summarize release notes",
    });
  });
});
