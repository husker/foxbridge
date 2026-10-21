// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble } from "./MessageBubble.js";

describe("MessageBubble", () => {
  it("renders FoxBridge document links as downloads", () => {
    render(
      <MessageBubble
        message={{
          role: "assistant",
          content: "[Download open-issues.docx](/api/download/doc-1)",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "Download open-issues.docx" });
    expect(link.getAttribute("href")).toBe("/api/download/doc-1");
    expect(link.getAttribute("download")).toBe("open-issues.docx");
  });

  it("notifies when a FoxBridge document download link is clicked", () => {
    const onDownload = vi.fn();

    render(
      <MessageBubble
        message={{
          role: "assistant",
          content: "[Download open-issues.docx](/api/download/doc-1)",
        }}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Download open-issues.docx" }));

    expect(onDownload).toHaveBeenCalledWith("open-issues.docx");
  });

  it("lets submitted user prompts be pinned from the bubble", () => {
    const onTogglePinnedPrompt = vi.fn();

    render(
      <MessageBubble
        message={{ role: "user", content: "Show my blockers" }}
        isPinnedPrompt={false}
        onTogglePinnedPrompt={onTogglePinnedPrompt}
      />,
    );

    fireEvent.click(screen.getByTitle("Pin prompt"));

    expect(onTogglePinnedPrompt).toHaveBeenCalledWith("Show my blockers");
  });

  it("shows an unpin action for already pinned user prompts", () => {
    render(
      <MessageBubble
        message={{ role: "user", content: "Show my blockers" }}
        isPinnedPrompt
        onTogglePinnedPrompt={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Unpin prompt")).toBeTruthy();
  });
});
