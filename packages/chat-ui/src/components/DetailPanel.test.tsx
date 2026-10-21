// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchIssue } from "../api.js";
import { openExternalUrl } from "../openExternalUrl.js";
import type { JiraIssueDetail } from "../types.js";
import { buildJiraBrowseUrl, DetailPanel } from "./DetailPanel.js";

vi.mock("../api.js", () => ({
  fetchIssue: vi.fn(),
}));

vi.mock("../openExternalUrl.js", () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

const issue: JiraIssueDetail = {
  key: "DEMO-790",
  summary: "Sidebar links should open Jira",
  description: null,
  status: "Open",
  priority: "High",
  assignee: "Alex",
  reporter: "FoxBridge",
  issueType: "Bug",
  created: "2026-05-24T12:00:00.000Z",
  updated: "2026-05-24T12:00:00.000Z",
  labels: [],
  components: [],
  project: "DEMO",
};

describe("DetailPanel Jira links", () => {
  beforeEach(() => {
    vi.mocked(fetchIssue).mockReset();
    vi.mocked(openExternalUrl).mockClear();
    vi.mocked(openExternalUrl).mockResolvedValue(undefined);
  });

  it("builds a Jira issue browse URL from the browser-facing base URL", () => {
    expect(buildJiraBrowseUrl("https://jira.example.com/", "DEMO-790")).toBe(
      "https://jira.example.com/browse/DEMO-790",
    );
  });

  it("opens Jira issue links with the browser-facing URL", async () => {
    vi.mocked(fetchIssue).mockResolvedValue({ issue, comments: [] });

    render(
      <DetailPanel
        issueKey="DEMO-790"
        onClose={vi.fn()}
        atlassianBaseUrl="https://jira.example.com"
      />,
    );

    fireEvent.click(await screen.findByRole("link", { name: /Open in Jira/ }));

    await waitFor(() => {
      expect(openExternalUrl).toHaveBeenCalledWith("https://jira.example.com/browse/DEMO-790");
    });
  });
});

describe("DetailPanel resizing", () => {
  beforeEach(() => {
    vi.mocked(fetchIssue).mockReset();
    vi.mocked(fetchIssue).mockResolvedValue({ issue, comments: [] });
  });

  it("uses the controlled panel width", async () => {
    const { container } = render(
      <DetailPanel
        issueKey="DEMO-790"
        onClose={vi.fn()}
        width={420}
        onWidthChange={vi.fn()}
      />,
    );

    expect((container.firstElementChild as HTMLElement).style.width).toBe("420px");
    await screen.findByText("Sidebar links should open Jira");
  });

  it("reports dragged widths from the left resize handle", async () => {
    const onWidthChange = vi.fn();

    render(
      <DetailPanel
        issueKey="DEMO-790"
        onClose={vi.fn()}
        width={420}
        onWidthChange={onWidthChange}
      />,
    );

    await screen.findByText("Sidebar links should open Jira");

    fireEvent.pointerDown(screen.getByLabelText("Resize ticket detail panel"), {
      clientX: 420,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 320,
      pointerId: 1,
    });

    expect(onWidthChange).toHaveBeenCalledWith(520);
  });
});

describe("DetailPanel Jira wiki rendering", () => {
  beforeEach(() => {
    vi.mocked(fetchIssue).mockReset();
  });

  it("renders Jira wiki descriptions and comments as readable structured content", async () => {
    vi.mocked(fetchIssue).mockResolvedValue({
      issue: {
        ...issue,
        description: `h2. Background
DEMO SDK is being deprecated.

* Replace DEMO SDK with Leaflet
* Preserve {{MapAdapter}}`,
      },
      comments: [
        {
          id: "1",
          author: "ATAYLOR",
          body: `h3. What's in this PR
* Cypress 15
See [#147|https://github.com/example-org/map-demo/pull/147]`,
          created: "2026-05-24T12:00:00.000Z",
          updated: "2026-05-24T12:00:00.000Z",
        },
      ],
    });

    render(
      <DetailPanel
        issueKey="DEMO-790"
        onClose={vi.fn()}
        width={420}
        onWidthChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Background" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "What's in this PR" })).toBeTruthy();
    expect(screen.getByText("Replace DEMO SDK with Leaflet")).toBeTruthy();
    expect(screen.getByText("MapAdapter").tagName.toLowerCase()).toBe("code");
    expect(screen.getByRole("link", { name: "#147" }).getAttribute("href")).toBe(
      "https://github.com/example-org/map-demo/pull/147",
    );
    expect(screen.queryByText("h2. Background")).toBeNull();
  });
});
