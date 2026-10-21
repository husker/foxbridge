import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { JiraDataCenterClient } from "./datacenter.js";

function mockFetch(responseBody: unknown, status = 200): AtlassianFetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(responseBody),
  }) as unknown as AtlassianFetch;
}

const rawIssue = {
  key: "TEST-1",
  id: "10001",
  fields: {
    summary: "Test issue",
    description: "A description",
    status: { name: "Open" },
    priority: { name: "High" },
    assignee: { name: "jdoe" },
    reporter: { name: "jsmith" },
    issuetype: { name: "Bug" },
    project: { key: "TEST" },
    created: "2025-01-01T00:00:00.000+0000",
    updated: "2025-01-02T00:00:00.000+0000",
    labels: ["backend"],
    components: [{ name: "API" }],
    fixVersions: [{ name: "1.0" }],
    issuelinks: [
      {
        id: "1",
        type: { name: "Blocks" },
        outwardIssue: { key: "TEST-2" },
      },
    ],
  },
};

describe("JiraDataCenterClient", () => {
  let fetchMock: AtlassianFetch;
  let client: JiraDataCenterClient;

  beforeEach(() => {
    fetchMock = mockFetch({});
    client = new JiraDataCenterClient(fetchMock);
  });

  describe("searchIssues", () => {
    it("calls /rest/api/2/search with JQL and normalizes response", async () => {
      const fetch = mockFetch({
        issues: [rawIssue],
        total: 1,
        maxResults: 50,
        startAt: 0,
      });
      client = new JiraDataCenterClient(fetch);

      const result = await client.searchIssues("project = TEST");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/search", {
        method: "POST",
        body: JSON.stringify({ jql: "project = TEST", maxResults: 50 }),
      });
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("TEST-1");
      expect(result.issues[0].summary).toBe("Test issue");
      expect(result.issues[0].description).toBe("A description");
      expect(result.issues[0].assignee).toBe("jdoe");
      expect(result.issues[0].links[0].type).toBe("Blocks");
      expect(result.total).toBe(1);
    });
  });

  describe("getIssue", () => {
    it("calls /rest/api/2/issue/{key} and normalizes response", async () => {
      const fetch = mockFetch(rawIssue);
      client = new JiraDataCenterClient(fetch);

      const issue = await client.getIssue("TEST-1");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue/TEST-1");
      expect(issue.key).toBe("TEST-1");
      expect(issue.summary).toBe("Test issue");
      expect(issue.status).toBe("Open");
      expect(issue.priority).toBe("High");
      expect(issue.issueType).toBe("Bug");
      expect(issue.projectKey).toBe("TEST");
      expect(issue.labels).toEqual(["backend"]);
      expect(issue.components).toEqual(["API"]);
      expect(issue.fixVersions).toEqual(["1.0"]);
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 404);
      client = new JiraDataCenterClient(fetch);

      await expect(client.getIssue("NOPE-1")).rejects.toThrow("Failed to get issue NOPE-1: 404");
    });
  });

  describe("createIssue", () => {
    it("POSTs to /rest/api/2/issue with correct body", async () => {
      const fetch = mockFetch({ key: "TEST-2", id: "10002" });
      client = new JiraDataCenterClient(fetch);

      const result = await client.createIssue("TEST", "Bug", "New bug", "Bug description");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue", {
        method: "POST",
        body: JSON.stringify({
          fields: {
            project: { key: "TEST" },
            issuetype: { name: "Bug" },
            summary: "New bug",
            description: "Bug description",
          },
        }),
      });
      expect(result.key).toBe("TEST-2");
      expect(result.id).toBe("10002");
    });

    it("includes extra fields when provided", async () => {
      const fetch = mockFetch({ key: "TEST-3", id: "10003" });
      client = new JiraDataCenterClient(fetch);

      await client.createIssue("TEST", "Task", "With labels", undefined, {
        labels: ["urgent"],
      });

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.fields.labels).toEqual(["urgent"]);
      expect(callBody.fields.description).toBeUndefined();
    });
  });

  describe("addComment", () => {
    it("POSTs to correct endpoint and returns normalized comment", async () => {
      const fetch = mockFetch({
        id: "100",
        body: "Hello world",
        author: { name: "jdoe" },
        created: "2025-01-01T00:00:00.000+0000",
        updated: "2025-01-01T00:00:00.000+0000",
      });
      client = new JiraDataCenterClient(fetch);

      const comment = await client.addComment("TEST-1", "Hello world");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue/TEST-1/comment", {
        method: "POST",
        body: JSON.stringify({ body: "Hello world" }),
      });
      expect(comment.id).toBe("100");
      expect(comment.body).toBe("Hello world");
      expect(comment.author).toBe("jdoe");
    });
  });

  describe("transitionIssue", () => {
    it("POSTs with transition ID", async () => {
      const fetch = mockFetch({});
      client = new JiraDataCenterClient(fetch);

      await client.transitionIssue("TEST-1", "31");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue/TEST-1/transitions", {
        method: "POST",
        body: JSON.stringify({ transition: { id: "31" } }),
      });
    });
  });

  describe("listProjects", () => {
    it("calls /rest/api/2/project and returns normalized projects", async () => {
      const fetch = mockFetch([
        { id: "1", key: "TEST", name: "Test Project", projectTypeKey: "software" },
        { id: "2", key: "OPS", name: "Operations", projectTypeKey: "business" },
      ]);
      client = new JiraDataCenterClient(fetch);

      const projects = await client.listProjects();

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/project");
      expect(projects).toHaveLength(2);
      expect(projects[0].key).toBe("TEST");
      expect(projects[1].name).toBe("Operations");
    });
  });

  describe("assignIssue", () => {
    it("PUTs to correct endpoint with { name: value }", async () => {
      const fetch = mockFetch({});
      client = new JiraDataCenterClient(fetch);

      await client.assignIssue("TEST-1", "jdoe");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue/TEST-1/assignee", {
        method: "PUT",
        body: JSON.stringify({ name: "jdoe" }),
      });
    });

    it("handles null for unassignment", async () => {
      const fetch = mockFetch({});
      client = new JiraDataCenterClient(fetch);

      await client.assignIssue("TEST-1", null);

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issue/TEST-1/assignee", {
        method: "PUT",
        body: JSON.stringify({ name: null }),
      });
    });
  });

  describe("linkIssues", () => {
    it("POSTs to /rest/api/2/issueLink with correct body", async () => {
      const fetch = mockFetch({});
      client = new JiraDataCenterClient(fetch);

      await client.linkIssues("TEST-1", "TEST-2", "Blocks");

      expect(fetch).toHaveBeenCalledWith("/rest/api/2/issueLink", {
        method: "POST",
        body: JSON.stringify({
          type: { name: "Blocks" },
          inwardIssue: { key: "TEST-1" },
          outwardIssue: { key: "TEST-2" },
        }),
      });
    });
  });
});
