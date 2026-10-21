import { describe, it, expect, vi } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { BitbucketCloudClient } from "./cloud.js";

function mockFetch(responseBody: unknown, status = 200): AtlassianFetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)),
  }) as unknown as AtlassianFetch;
}

describe("BitbucketCloudClient", () => {
  describe("listRepos", () => {
    it("uses workspace-based URL structure", async () => {
      const fetch = mockFetch({
        values: [
          { slug: "my-repo", name: "My Repo", description: "A repo", is_private: false, mainbranch: { name: "main" } },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const repos = await client.listRepos("my-workspace");

      expect(fetch).toHaveBeenCalledWith("/2.0/repositories/my-workspace");
      expect(repos).toHaveLength(1);
      expect(repos[0].slug).toBe("my-repo");
      expect(repos[0].projectKey).toBe("my-workspace");
      expect(repos[0].defaultBranch).toBe("main");
      expect(repos[0].isPublic).toBe(true);
    });
  });

  describe("browseFiles", () => {
    it("uses /src/{ref}/{path} URL structure", async () => {
      const fetch = mockFetch({
        values: [
          { path: "src", type: "commit_directory" },
          { path: "README.md", type: "commit_file", size: 512 },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const files = await client.browseFiles("ws", "my-repo", "src", "main");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/src/main/src",
      );
      expect(files).toHaveLength(2);
      expect(files[0].type).toBe("directory");
      expect(files[1].type).toBe("file");
      expect(files[1].size).toBe(512);
    });

    it("uses HEAD when no ref provided", async () => {
      const fetch = mockFetch({ values: [] });
      const client = new BitbucketCloudClient(fetch);

      await client.browseFiles("ws", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/src/HEAD",
      );
    });
  });

  describe("readFile", () => {
    it("returns text content", async () => {
      const fetch = mockFetch("file contents here");
      const client = new BitbucketCloudClient(fetch);

      const content = await client.readFile("ws", "my-repo", "index.js", "main");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/src/main/index.js",
      );
      expect(content).toBe("file contents here");
    });
  });

  describe("listBranches", () => {
    it("uses /refs/branches endpoint", async () => {
      const fetch = mockFetch({
        values: [
          { name: "main", target: { hash: "abc123" } },
          { name: "develop", target: { hash: "def456" } },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const branches = await client.listBranches("ws", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/refs/branches",
      );
      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe("main");
      expect(branches[0].latestCommit).toBe("abc123");
    });
  });

  describe("createBranch", () => {
    it("POSTs with target hash format", async () => {
      const fetch = mockFetch({
        name: "feature/x",
        target: { hash: "abc123" },
      });
      const client = new BitbucketCloudClient(fetch);

      const branch = await client.createBranch("ws", "my-repo", "feature/x", "abc123");

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody).toEqual({ name: "feature/x", target: { hash: "abc123" } });
      expect(branch.name).toBe("feature/x");
      expect(branch.latestCommit).toBe("abc123");
    });
  });

  describe("deleteBranch", () => {
    it("DELETEs at branch name URL", async () => {
      const fetch = mockFetch({}, 204);
      const client = new BitbucketCloudClient(fetch);

      await client.deleteBranch("ws", "my-repo", "feature/old");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/refs/branches/feature%2Fold",
        { method: "DELETE" },
      );
    });
  });

  describe("listPullRequests", () => {
    it("uses pullrequests (no hyphen) in URL", async () => {
      const fetch = mockFetch({
        values: [
          {
            id: 1,
            title: "Cloud PR",
            description: "A PR",
            state: "OPEN",
            author: { display_name: "Jane Doe" },
            source: { branch: { name: "feature/x" } },
            destination: { branch: { name: "main" } },
            created_on: "2025-01-01T00:00:00.000Z",
            updated_on: "2025-01-02T00:00:00.000Z",
          },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const prs = await client.listPullRequests("ws", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/pullrequests",
      );
      expect(prs).toHaveLength(1);
      expect(prs[0].title).toBe("Cloud PR");
      expect(prs[0].author).toBe("Jane Doe");
      expect(prs[0].sourceBranch).toBe("feature/x");
    });
  });

  describe("createPullRequest", () => {
    it("POSTs with source/destination branch format", async () => {
      const fetch = mockFetch({
        id: 42,
        title: "New PR",
        description: "PR desc",
        state: "OPEN",
        author: { display_name: "Jane" },
        source: { branch: { name: "feature/x" } },
        destination: { branch: { name: "main" } },
        created_on: "2025-01-01T00:00:00.000Z",
        updated_on: "2025-01-01T00:00:00.000Z",
      });
      const client = new BitbucketCloudClient(fetch);

      const pr = await client.createPullRequest("ws", "my-repo", "New PR", "feature/x", "main", "PR desc");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/pullrequests",
        expect.objectContaining({ method: "POST" }),
      );
      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.source.branch.name).toBe("feature/x");
      expect(callBody.destination.branch.name).toBe("main");
      expect(pr.id).toBe(42);
    });
  });

  describe("listCommits", () => {
    it("uses Cloud commit format with hash", async () => {
      const fetch = mockFetch({
        values: [
          {
            hash: "abc123def456",
            message: "Initial commit",
            author: { user: { display_name: "Jane Doe" }, raw: "Jane <jane@example.com>" },
            date: "2025-01-01T00:00:00.000Z",
            parents: [{ hash: "parent1" }],
          },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const commits = await client.listCommits("ws", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/commits",
      );
      expect(commits).toHaveLength(1);
      expect(commits[0].id).toBe("abc123def456");
      expect(commits[0].author).toBe("Jane Doe");
      expect(commits[0].parents).toEqual(["parent1"]);
    });

    it("includes ref in URL path", async () => {
      const fetch = mockFetch({ values: [] });
      const client = new BitbucketCloudClient(fetch);

      await client.listCommits("ws", "my-repo", "develop", 5);

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/commits/develop?pagelen=5",
      );
    });
  });

  describe("getDiff", () => {
    it("returns plain text diff from Cloud", async () => {
      const diffText = "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n-old\n+new";
      const fetch = mockFetch(diffText);
      const client = new BitbucketCloudClient(fetch);

      const diff = await client.getDiff("ws", "my-repo", "abc123");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/diff/abc123",
      );
      expect(diff).toBe(diffText);
    });
  });

  describe("searchCode", () => {
    it("uses Cloud search endpoint with search_query param", async () => {
      const fetch = mockFetch({
        values: [
          {
            file: { path: "src/app.ts" },
            content_matches: [
              { lines: [{ line: "import express" }] },
            ],
          },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const results = await client.searchCode("ws", "my-repo", "import express");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/search/code?search_query=import%20express&workspace=ws",
      );
      expect(results).toHaveLength(1);
      expect(results[0].file).toBe("src/app.ts");
    });
  });

  describe("addPrComment", () => {
    it("POSTs with content.raw format", async () => {
      const fetch = mockFetch({
        id: 10,
        content: { raw: "Great work!" },
        user: { display_name: "Jane" },
        created_on: "2025-01-01T00:00:00.000Z",
        updated_on: "2025-01-01T00:00:00.000Z",
      });
      const client = new BitbucketCloudClient(fetch);

      const comment = await client.addPrComment("ws", "my-repo", 1, "Great work!");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/pullrequests/1/comments",
        {
          method: "POST",
          body: JSON.stringify({ content: { raw: "Great work!" } }),
        },
      );
      expect(comment.text).toBe("Great work!");
      expect(comment.author).toBe("Jane");
    });
  });

  describe("listWebhooks", () => {
    it("uses /hooks endpoint", async () => {
      const fetch = mockFetch({
        values: [
          { uuid: "{12345678-0000-0000-0000-000000000000}", description: "CI", url: "https://ci.example.com", events: ["repo:push"], active: true },
        ],
      });
      const client = new BitbucketCloudClient(fetch);

      const hooks = await client.listWebhooks("ws", "my-repo");

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/hooks",
      );
      expect(hooks).toHaveLength(1);
      expect(hooks[0].name).toBe("CI");
      expect(hooks[0].events).toEqual(["repo:push"]);
    });
  });

  describe("mergePullRequest", () => {
    it("POSTs to merge endpoint using pullrequests URL", async () => {
      const fetch = mockFetch({});
      const client = new BitbucketCloudClient(fetch);

      await client.mergePullRequest("ws", "my-repo", 1);

      expect(fetch).toHaveBeenCalledWith(
        "/2.0/repositories/ws/my-repo/pullrequests/1/merge",
        { method: "POST" },
      );
    });
  });

  describe("error handling", () => {
    it("throws on error response", async () => {
      const fetch = mockFetch({}, 403);
      const client = new BitbucketCloudClient(fetch);

      await expect(client.listRepos("ws")).rejects.toThrow("Failed to list repos: 403");
    });
  });
});
