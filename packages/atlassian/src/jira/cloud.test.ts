import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { JiraCloudClient } from "./cloud.js";
import { adfToText, textToAdf } from "../adf.js";

function mockFetch(responseBody: unknown, status = 200): AtlassianFetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(responseBody),
  }) as unknown as AtlassianFetch;
}

const adfDescription = {
  type: "doc",
  version: 1,
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "A description in ADF" },
      ],
    },
  ],
};

const rawCloudIssue = {
  key: "CLOUD-1",
  id: "20001",
  fields: {
    summary: "Cloud issue",
    description: adfDescription,
    status: { name: "To Do" },
    priority: { name: "Medium" },
    assignee: { accountId: "abc123" },
    reporter: { accountId: "def456" },
    issuetype: { name: "Story" },
    project: { key: "CLOUD" },
    created: "2025-02-01T00:00:00.000+0000",
    updated: "2025-02-02T00:00:00.000+0000",
    labels: ["frontend"],
    components: [{ name: "UI" }],
    fixVersions: [{ name: "2.0" }],
    issuelinks: [],
  },
};

describe("adfToText", () => {
  it("extracts text from a simple ADF document", () => {
    const result = adfToText(adfDescription);
    expect(result.trim()).toBe("A description in ADF");
  });

  it("handles nested content with multiple paragraphs", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First paragraph" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second paragraph" },
          ],
        },
      ],
    };
    const result = adfToText(adf);
    expect(result.trim()).toContain("First paragraph");
    expect(result.trim()).toContain("Second paragraph");
  });

  it("handles headings", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "heading",
          content: [
            { type: "text", text: "My Heading" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body text" },
          ],
        },
      ],
    };
    const result = adfToText(adf);
    expect(result).toContain("My Heading");
    expect(result).toContain("Body text");
  });

  it("returns empty string for null/undefined", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
  });
});

describe("textToAdf", () => {
  it("produces valid minimal ADF", () => {
    const result = textToAdf("Hello world");
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
    const content = result.content as Array<{ type: string; content: Array<{ type: string; text: string }> }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("paragraph");
    expect(content[0].content[0].text).toBe("Hello world");
  });

  it("splits multi-line text into separate paragraphs", () => {
    const result = textToAdf("Line one\nLine two\nLine three");
    const content = result.content as Array<{ type: string; content: Array<{ type: string; text: string }> }>;
    expect(content).toHaveLength(3);
    expect(content[0].content[0].text).toBe("Line one");
    expect(content[1].content[0].text).toBe("Line two");
    expect(content[2].content[0].text).toBe("Line three");
  });
});

describe("JiraCloudClient", () => {
  let fetchMock: AtlassianFetch;
  let client: JiraCloudClient;

  beforeEach(() => {
    fetchMock = mockFetch({});
    client = new JiraCloudClient(fetchMock);
  });

  describe("searchIssues", () => {
    it("calls /rest/api/3/search/jql with explicit fields param and normalizes ADF description", async () => {
      // Atlassian's new /search/jql endpoint returns cursor-based pagination:
      //   { issues: [...], nextPageToken: "...", isLast: boolean }
      // and requires an explicit ?fields= param to include anything beyond `id`.
      const fetch = mockFetch({
        issues: [rawCloudIssue],
        nextPageToken: "tok-next",
        isLast: false,
      });
      client = new JiraCloudClient(fetch);

      const result = await client.searchIssues("project = CLOUD");

      // URL must target /search/jql AND request the fields used by normalizeIssue.
      const calledUrl = (fetch as unknown as Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain("/rest/api/3/search/jql");
      expect(calledUrl).toContain("fields=");
      for (const field of [
        "summary",
        "status",
        "priority",
        "assignee",
        "reporter",
        "issuetype",
        "project",
      ]) {
        expect(calledUrl).toContain(field);
      }

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("CLOUD-1");
      expect(result.issues[0].description).toBe("A description in ADF");
      expect(result.issues[0].assignee).toBe("abc123");
      expect(result.nextPageToken).toBe("tok-next");
      expect(result.isLast).toBe(false);
    });
  });

  describe("getIssue", () => {
    it("calls /rest/api/3/issue/{key} and handles ADF", async () => {
      const fetch = mockFetch(rawCloudIssue);
      client = new JiraCloudClient(fetch);

      const issue = await client.getIssue("CLOUD-1");

      expect(fetch).toHaveBeenCalledWith("/rest/api/3/issue/CLOUD-1");
      expect(issue.key).toBe("CLOUD-1");
      expect(issue.description).toBe("A description in ADF");
      expect(issue.status).toBe("To Do");
      expect(issue.assignee).toBe("abc123");
      expect(issue.reporter).toBe("def456");
    });

    it("returns null description when ADF is null", async () => {
      const issueNoDesc = {
        ...rawCloudIssue,
        fields: { ...rawCloudIssue.fields, description: null },
      };
      const fetch = mockFetch(issueNoDesc);
      client = new JiraCloudClient(fetch);

      const issue = await client.getIssue("CLOUD-1");
      expect(issue.description).toBeNull();
    });
  });

  describe("createIssue", () => {
    it("converts description text to ADF before sending", async () => {
      const fetch = mockFetch({ key: "CLOUD-2", id: "20002" });
      client = new JiraCloudClient(fetch);

      const result = await client.createIssue("CLOUD", "Story", "New story", "Some description");

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.fields.description).toEqual(textToAdf("Some description"));
      expect(callBody.fields.description.type).toBe("doc");
      expect(result.key).toBe("CLOUD-2");
    });
  });

  describe("listProjects", () => {
    it("uses /rest/api/3/project/search (paginated)", async () => {
      const fetch = mockFetch({
        values: [
          { id: "1", key: "CLOUD", name: "Cloud Project", projectTypeKey: "software" },
        ],
      });
      client = new JiraCloudClient(fetch);

      const projects = await client.listProjects();

      expect(fetch).toHaveBeenCalledWith("/rest/api/3/project/search");
      expect(projects).toHaveLength(1);
      expect(projects[0].key).toBe("CLOUD");
    });
  });

  describe("assignIssue", () => {
    it("PUTs with { accountId: value }", async () => {
      const fetch = mockFetch({});
      client = new JiraCloudClient(fetch);

      await client.assignIssue("CLOUD-1", "abc123");

      expect(fetch).toHaveBeenCalledWith("/rest/api/3/issue/CLOUD-1/assignee", {
        method: "PUT",
        body: JSON.stringify({ accountId: "abc123" }),
      });
    });

    it("handles null for unassignment", async () => {
      const fetch = mockFetch({});
      client = new JiraCloudClient(fetch);

      await client.assignIssue("CLOUD-1", null);

      expect(fetch).toHaveBeenCalledWith("/rest/api/3/issue/CLOUD-1/assignee", {
        method: "PUT",
        body: JSON.stringify({ accountId: null }),
      });
    });
  });

  describe("addComment", () => {
    it("sends ADF body and returns plain text", async () => {
      const fetch = mockFetch({
        id: "200",
        body: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Nice work" }] },
          ],
        },
        author: { accountId: "abc123" },
        created: "2025-02-01T00:00:00.000+0000",
        updated: "2025-02-01T00:00:00.000+0000",
      });
      client = new JiraCloudClient(fetch);

      const comment = await client.addComment("CLOUD-1", "Nice work");

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.body).toEqual(textToAdf("Nice work"));
      expect(comment.id).toBe("200");
      expect(comment.body).toBe("Nice work");
      expect(comment.author).toBe("abc123");
    });
  });
});
