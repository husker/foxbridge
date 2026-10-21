import { describe, it, expect, vi } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { BitbucketDataCenterClient } from "./datacenter.js";

function mockFetch(responseBody: unknown, status = 200): AtlassianFetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)),
  }) as unknown as AtlassianFetch;
}

describe("BitbucketDataCenterClient", () => {
  describe("listRepos", () => {
    it("calls correct endpoint and normalizes repos", async () => {
      const fetch = mockFetch({
        values: [
          { slug: "my-repo", name: "My Repo", description: "A repo", public: true },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const repos = await client.listRepos("PROJ");

      expect(fetch).toHaveBeenCalledWith("/rest/api/1.0/projects/PROJ/repos");
      expect(repos).toHaveLength(1);
      expect(repos[0].slug).toBe("my-repo");
      expect(repos[0].name).toBe("My Repo");
      expect(repos[0].projectKey).toBe("PROJ");
      expect(repos[0].isPublic).toBe(true);
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 404);
      const client = new BitbucketDataCenterClient(fetch);

      await expect(client.listRepos("NOPE")).rejects.toThrow("Failed to list repos: 404");
    });
  });

  describe("browseFiles", () => {
    it("calls correct endpoint without path or ref", async () => {
      const fetch = mockFetch({
        children: {
          values: [
            { path: { toString: "src" }, type: "DIRECTORY" },
            { path: { toString: "README.md" }, type: "FILE", size: 1024 },
          ],
        },
      });
      const client = new BitbucketDataCenterClient(fetch);

      const files = await client.browseFiles("PROJ", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/browse",
      );
      expect(files).toHaveLength(2);
    });

    it("includes path and ref when provided", async () => {
      const fetch = mockFetch({ children: { values: [] } });
      const client = new BitbucketDataCenterClient(fetch);

      await client.browseFiles("PROJ", "my-repo", "src/main", "develop");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/browse/src/main?at=develop",
      );
    });
  });

  describe("readFile", () => {
    it("returns text content from raw endpoint", async () => {
      const fetch = mockFetch("console.log('hello');");
      const client = new BitbucketDataCenterClient(fetch);

      const content = await client.readFile("PROJ", "my-repo", "index.js");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/raw/index.js",
      );
      expect(content).toBe("console.log('hello');");
    });

    it("includes ref parameter", async () => {
      const fetch = mockFetch("old content");
      const client = new BitbucketDataCenterClient(fetch);

      await client.readFile("PROJ", "my-repo", "index.js", "v1.0");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/raw/index.js?at=v1.0",
      );
    });
  });

  describe("listBranches", () => {
    it("returns normalized branches", async () => {
      const fetch = mockFetch({
        values: [
          { displayId: "main", latestCommit: "abc123", isDefault: true },
          { displayId: "develop", latestCommit: "def456", isDefault: false },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const branches = await client.listBranches("PROJ", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/branches",
      );
      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe("main");
      expect(branches[0].latestCommit).toBe("abc123");
      expect(branches[0].isDefault).toBe(true);
      expect(branches[1].name).toBe("develop");
      expect(branches[1].isDefault).toBe(false);
    });
  });

  describe("createBranch", () => {
    it("POSTs correctly and returns branch", async () => {
      const fetch = mockFetch({
        displayId: "feature/x",
        latestCommit: "abc123",
        isDefault: false,
      });
      const client = new BitbucketDataCenterClient(fetch);

      const branch = await client.createBranch("PROJ", "my-repo", "feature/x", "abc123");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/branches",
        {
          method: "POST",
          body: JSON.stringify({ name: "feature/x", startPoint: "abc123" }),
        },
      );
      expect(branch.name).toBe("feature/x");
      expect(branch.latestCommit).toBe("abc123");
    });
  });

  describe("listPullRequests", () => {
    it("returns normalized pull requests", async () => {
      const fetch = mockFetch({
        values: [
          {
            id: 1,
            title: "Add feature",
            description: "New feature",
            state: "OPEN",
            author: { user: { name: "jdoe" } },
            fromRef: { displayId: "feature/x" },
            toRef: { displayId: "main" },
            createdDate: 1700000000000,
            updatedDate: 1700000001000,
          },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const prs = await client.listPullRequests("PROJ", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/pull-requests",
      );
      expect(prs).toHaveLength(1);
      expect(prs[0].id).toBe(1);
      expect(prs[0].title).toBe("Add feature");
      expect(prs[0].author).toBe("jdoe");
      expect(prs[0].sourceBranch).toBe("feature/x");
      expect(prs[0].targetBranch).toBe("main");
    });

    it("passes state parameter", async () => {
      const fetch = mockFetch({ values: [] });
      const client = new BitbucketDataCenterClient(fetch);

      await client.listPullRequests("PROJ", "my-repo", "MERGED");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/pull-requests?state=MERGED",
      );
    });
  });

  describe("createPullRequest", () => {
    it("POSTs correctly with fromRef/toRef format", async () => {
      const fetch = mockFetch({
        id: 42,
        title: "New PR",
        description: "PR description",
        state: "OPEN",
        author: { user: { name: "jdoe" } },
        fromRef: { displayId: "feature/x" },
        toRef: { displayId: "main" },
        createdDate: 1700000000000,
        updatedDate: 1700000000000,
      });
      const client = new BitbucketDataCenterClient(fetch);

      const pr = await client.createPullRequest("PROJ", "my-repo", "New PR", "feature/x", "main", "PR description");

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.title).toBe("New PR");
      expect(callBody.fromRef.id).toBe("refs/heads/feature/x");
      expect(callBody.toRef.id).toBe("refs/heads/main");
      expect(pr.id).toBe(42);
      expect(pr.title).toBe("New PR");
    });
  });

  describe("listCommits", () => {
    it("returns normalized commits", async () => {
      const fetch = mockFetch({
        values: [
          {
            id: "abc123",
            message: "Initial commit",
            author: { name: "jdoe" },
            authorTimestamp: 1700000000000,
            parents: [{ id: "parent1" }],
          },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const commits = await client.listCommits("PROJ", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/commits",
      );
      expect(commits).toHaveLength(1);
      expect(commits[0].id).toBe("abc123");
      expect(commits[0].message).toBe("Initial commit");
      expect(commits[0].author).toBe("jdoe");
      expect(commits[0].parents).toEqual(["parent1"]);
    });

    it("includes ref and limit parameters", async () => {
      const fetch = mockFetch({ values: [] });
      const client = new BitbucketDataCenterClient(fetch);

      await client.listCommits("PROJ", "my-repo", "develop", 10);

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/commits?until=develop&limit=10",
      );
    });
  });

  describe("getDiff", () => {
    it("returns diff text extracted from hunks", async () => {
      const fetch = mockFetch({
        diffs: [
          {
            hunks: [
              {
                segments: [
                  {
                    type: "REMOVED",
                    lines: [{ line: "old line" }],
                  },
                  {
                    type: "ADDED",
                    lines: [{ line: "new line" }],
                  },
                ],
              },
            ],
          },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const diff = await client.getDiff("PROJ", "my-repo", "abc123");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/commits/abc123/diff",
      );
      expect(diff).toContain("-old line");
      expect(diff).toContain("+new line");
    });
  });

  describe("addPrComment", () => {
    it("POSTs comment and returns normalized result", async () => {
      const fetch = mockFetch({
        id: 10,
        text: "Looks good!",
        author: { name: "jdoe" },
        createdDate: 1700000000000,
        updatedDate: 1700000000000,
      });
      const client = new BitbucketDataCenterClient(fetch);

      const comment = await client.addPrComment("PROJ", "my-repo", 1, "Looks good!");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/pull-requests/1/comments",
        {
          method: "POST",
          body: JSON.stringify({ text: "Looks good!" }),
        },
      );
      expect(comment.id).toBe(10);
      expect(comment.text).toBe("Looks good!");
      expect(comment.author).toBe("jdoe");
    });
  });

  describe("searchCode", () => {
    it("calls search endpoint with correct params", async () => {
      const fetch = mockFetch({
        values: [
          {
            file: { path: "src/index.ts" },
            hitContexts: [{ context: "import foo" }],
          },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const results = await client.searchCode("PROJ", "my-repo", "import foo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/search/1.0/search?query=import%20foo&projectKey=PROJ&repoSlug=my-repo",
      );
      expect(results).toHaveLength(1);
      expect(results[0].file).toBe("src/index.ts");
      expect(results[0].matches).toEqual(["import foo"]);
    });
  });

  describe("deleteBranch", () => {
    it("DELETEs with name and dryRun: false", async () => {
      const fetch = mockFetch({}, 204);
      const client = new BitbucketDataCenterClient(fetch);

      await client.deleteBranch("PROJ", "my-repo", "feature/old");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/branches",
        {
          method: "DELETE",
          body: JSON.stringify({ name: "feature/old", dryRun: false }),
        },
      );
    });
  });

  describe("mergePullRequest", () => {
    it("POSTs to merge endpoint", async () => {
      const fetch = mockFetch({});
      const client = new BitbucketDataCenterClient(fetch);

      await client.mergePullRequest("PROJ", "my-repo", 1);

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/pull-requests/1/merge",
        { method: "POST" },
      );
    });
  });

  describe("declinePullRequest", () => {
    it("POSTs to decline endpoint", async () => {
      const fetch = mockFetch({});
      const client = new BitbucketDataCenterClient(fetch);

      await client.declinePullRequest("PROJ", "my-repo", 1);

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/pull-requests/1/decline",
        { method: "POST" },
      );
    });
  });

  describe("listWebhooks", () => {
    it("returns normalized webhooks", async () => {
      const fetch = mockFetch({
        values: [
          { id: 1, name: "CI hook", url: "https://ci.example.com", events: ["repo:push"], active: true },
        ],
      });
      const client = new BitbucketDataCenterClient(fetch);

      const hooks = await client.listWebhooks("PROJ", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/1.0/projects/PROJ/repos/my-repo/webhooks",
      );
      expect(hooks).toHaveLength(1);
      expect(hooks[0].name).toBe("CI hook");
      expect(hooks[0].events).toEqual(["repo:push"]);
    });
  });
});
