// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JiraWikiContent } from "./JiraWikiContent.js";

describe("JiraWikiContent", () => {
  it("renders Jira wiki headings and lists as structured content", () => {
    render(
      <JiraWikiContent
        text={`h2. Background
DEMO SDK is being deprecated across demo applications.

h2. Scope
* Replace DEMO SDK with Leaflet + Geoman
* Preserve {{mainMapApiRef}} API surface

h2. Testing strategy
# Unit tests
# Cypress E2E`}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Background" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Scope" })).toBeTruthy();
    expect(screen.getByText("Replace DEMO SDK with Leaflet + Geoman")).toBeTruthy();
    expect(screen.getByText("Unit tests")).toBeTruthy();
    expect(screen.getByText("mainMapApiRef")).toBeTruthy();
    expect(screen.queryByText("h2. Background")).toBeNull();
  });

  it("renders inline code, code blocks, and Jira links without raw delimiters", () => {
    render(
      <JiraWikiContent
        text={`Preserve {{MapAdapter}} and review [#147|https://github.com/example-org/map-demo/pull/147].

{code}
npm run test:e2e:headless
{code}`}
      />,
    );

    expect(screen.getByText("MapAdapter").tagName.toLowerCase()).toBe("code");
    expect(screen.getByRole("link", { name: "#147" }).getAttribute("href")).toBe(
      "https://github.com/example-org/map-demo/pull/147",
    );
    expect(screen.getByText("npm run test:e2e:headless").tagName.toLowerCase()).toBe("code");
    expect(screen.queryByText("{{MapAdapter}}")).toBeNull();
    expect(screen.queryByText("{code}")).toBeNull();
  });

  it("renders panel macros, Jira emphasis, color spans, mail links, and bare URLs", () => {
    render(
      <JiraWikiContent
        text={`{panel}
*From:* Taylor, Alex Engineering <Alex.Taylor@example.com>
*_Email:_* ** [*alex.taylor@example.com*|mailto:alex.taylor@example.com]
{panel}

*{color:red}Note{color}*
 https://apps.example.com/int/jenkins/job/DEMO/job/demo-api/309/promotion/0_INTEGRATION/promotionBuild/342/`}
      />,
    );

    const panel = screen.getByRole("note");
    expect(panel.textContent).toContain("From: Taylor, Alex Engineering");
    expect(screen.getByText("From:").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("Email:").tagName.toLowerCase()).toBe("em");
    expect(screen.getByText("Note").getAttribute("style")).toContain("color: red");
    expect(screen.getByRole("link", { name: "alex.taylor@example.com" }).getAttribute("href")).toBe(
      "mailto:alex.taylor@example.com",
    );
    expect(
      screen
        .getByRole("link", {
          name: "https://apps.example.com/int/jenkins/job/DEMO/job/demo-api/309/promotion/0_INTEGRATION/promotionBuild/342/",
        })
        .getAttribute("href"),
    ).toBe(
      "https://apps.example.com/int/jenkins/job/DEMO/job/demo-api/309/promotion/0_INTEGRATION/promotionBuild/342/",
    );
    expect(screen.queryByText("{panel}")).toBeNull();
    expect(screen.queryByText("{color:red}Note{color}")).toBeNull();
  });
});
