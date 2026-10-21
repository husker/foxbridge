// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "../api.js";
import { ChatPanel } from "./ChatPanel.js";

vi.mock("../api.js", () => ({
  sendMessage: vi.fn().mockResolvedValue("Done"),
}));

describe("ChatPanel pinned prompts", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue("Done");
  });

  it("lets users pin a prompt after it has been submitted", async () => {
    const onTogglePinnedPrompt = vi.fn();

    render(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
        pinnedPrompts={[]}
        onTogglePinnedPrompt={onTogglePinnedPrompt}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ask anything about your Atlassian data..."), {
      target: { value: "Show my open issues" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByTitle("Pin prompt"));

    expect(onTogglePinnedPrompt).toHaveBeenCalledWith("Show my open issues");
  });

  it("shows feedback after clicking a generated download link", async () => {
    vi.mocked(sendMessage).mockImplementation(async (_message, onChunk) => {
      onChunk("[Download export.docx](/api/download/doc-1)");
      return "[Download export.docx](/api/download/doc-1)";
    });

    render(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ask anything about your Atlassian data..."), {
      target: { value: "save this as a docx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("link", { name: "Download export.docx" });
    await waitFor(() => expect(screen.queryByText("Thinking")).toBeNull());
    fireEvent.click(screen.getByRole("link", { name: "Download export.docx" }));

    expect((await screen.findByRole("status")).textContent).toBe("Download started: export.docx");
  });

  it("reports message changes so the active conversation can be saved", async () => {
    const onMessagesChanged = vi.fn();

    render(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
        conversationId="conv-1"
        onMessagesChanged={onMessagesChanged}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ask anything about your Atlassian data..."), {
      target: { value: "summarize my blockers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onMessagesChanged).toHaveBeenLastCalledWith([
        { role: "user", content: "summarize my blockers" },
        { role: "assistant", content: "Done" },
      ]);
    });
  });

  it("loads messages when the active conversation changes", () => {
    const { rerender } = render(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
        conversationId="conv-1"
        initialMessages={[{ role: "user", content: "first conversation" }]}
      />,
    );

    expect(screen.getByText("first conversation")).toBeTruthy();

    rerender(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
        conversationId="conv-2"
        initialMessages={[{ role: "user", content: "second conversation" }]}
      />,
    );

    expect(screen.queryByText("first conversation")).toBeNull();
    expect(screen.getByText("second conversation")).toBeTruthy();
  });

  it("aligns the file attach button with the input text and darkens it on hover", () => {
    const { container } = render(
      <ChatPanel
        onIssueClick={vi.fn()}
        onRecentItemsFound={vi.fn()}
      />,
    );

    const form = container.querySelector("form") as HTMLFormElement;
    const attachButton = screen.getByTitle("Attach files");
    const input = screen.getByPlaceholderText("Ask anything about your Atlassian data...");

    expect(form.style.alignItems).toBe("center");
    expect((input as HTMLTextAreaElement).rows).toBe(1);
    expect(attachButton.style.alignSelf).toBe("center");
    expect(attachButton.style.color).toBe("var(--text-secondary)");

    fireEvent.mouseEnter(attachButton);

    expect(attachButton.style.color).toBe("var(--primary)");
  });
});
