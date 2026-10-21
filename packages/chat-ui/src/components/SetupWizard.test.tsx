// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("SetupWizard", () => {
  it("goes directly from Atlassian settings to AI and saves a read-only configuration", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Fixture: save intercepted" }) });
    vi.stubGlobal("fetch", request);
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.queryByText(/License Key/i)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("https://jira.yourcompany.com"), { target: { value: "https://jira.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ollama" } });
    fireEvent.change(screen.getByPlaceholderText("http://host.docker.internal:11434"), { target: { value: "http://localhost:11434" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const writeToggles = screen.getAllByRole("checkbox").filter((input) => input.parentElement?.textContent?.includes("Write"));
    expect(writeToggles).toHaveLength(3);
    expect(writeToggles.every((input) => !(input as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and Restart" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("/api/setup/save");
    const config = JSON.parse(options.body);
    expect(config).not.toHaveProperty("license_key");
    expect(config.features_jira_write).toBe(false);
    expect(config.features_confluence_write).toBe(false);
    expect(config.ai_provider).toBe("ollama");
    await screen.findByText("Fixture: save intercepted");
  });
});
