import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxbridgeConfig } from "@foxbridge/config";
import {
  createAtlassianFetch,
  createBitbucketClient,
  type UserCredentials,
} from "@foxbridge/atlassian";
import type { PiiScrubber } from "@foxbridge/scrubber";
import { shouldRegisterTool } from "../middleware/feature-toggle.js";
import { scrubToolResult } from "../middleware/scrub.js";

function fmt(data: unknown, scrubber: PiiScrubber | null): string {
  const text = JSON.stringify(data, null, 2);
  return scrubToolResult(text, scrubber);
}

function textResult(data: unknown, scrubber: PiiScrubber | null) {
  return { content: [{ type: "text" as const, text: fmt(data, scrubber) }] };
}

export function registerBitbucketTools(
  server: McpServer,
  config: FoxbridgeConfig,
  credentials: UserCredentials,
  scrubber: PiiScrubber | null,
): void {
  const bbUrl = config.atlassian.bitbucket_url ?? config.atlassian.base_url;
  const fetch = createAtlassianFetch(bbUrl, config.atlassian.platform, credentials, config.atlassian.auth_method);
  const client = createBitbucketClient(fetch, config.atlassian.platform);
  const features = config.features;

  // ── Read tools ──────────────────────────────────────────────────────

  if (shouldRegisterTool("bitbucket", "read", features)) {
    server.tool(
      "bitbucket_list_repos",
      "List Bitbucket repositories in a project",
      {
        projectKey: z.string().describe("Project key"),
      },
      async (args) => {
        const result = await client.listRepos(args.projectKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_browse_files",
      "Browse files in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        path: z.string().optional().describe("Path within the repository"),
        ref: z.string().optional().describe("Branch, tag, or commit reference"),
      },
      async (args) => {
        const result = await client.browseFiles(args.projectKey, args.repoSlug, args.path, args.ref);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_read_file",
      "Read the content of a file in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        filePath: z.string().describe("Path to the file"),
        ref: z.string().optional().describe("Branch, tag, or commit reference"),
      },
      async (args) => {
        const result = await client.readFile(args.projectKey, args.repoSlug, args.filePath, args.ref);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_search_code",
      "Search code in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        query: z.string().describe("Search query"),
      },
      async (args) => {
        const result = await client.searchCode(args.projectKey, args.repoSlug, args.query);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_list_branches",
      "List branches in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
      },
      async (args) => {
        const result = await client.listBranches(args.projectKey, args.repoSlug);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_list_pull_requests",
      "List pull requests in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        state: z.string().optional().describe("Filter by state (OPEN, MERGED, DECLINED)"),
      },
      async (args) => {
        const result = await client.listPullRequests(args.projectKey, args.repoSlug, args.state);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_read_pull_request",
      "Read a single pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
      },
      async (args) => {
        const result = await client.getPullRequest(args.projectKey, args.repoSlug, args.prId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_list_pr_comments",
      "List comments on a Bitbucket pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
      },
      async (args) => {
        const result = await client.listPrComments(args.projectKey, args.repoSlug, args.prId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_list_commits",
      "List commits in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        ref: z.string().optional().describe("Branch, tag, or commit reference"),
        maxResults: z.number().optional().describe("Maximum number of results"),
      },
      async (args) => {
        const result = await client.listCommits(args.projectKey, args.repoSlug, args.ref, args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_get_commit",
      "Get details of a single commit",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        commitId: z.string().describe("Commit hash"),
      },
      async (args) => {
        const result = await client.getCommit(args.projectKey, args.repoSlug, args.commitId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_get_diff",
      "Get the diff of a commit",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        commitId: z.string().describe("Commit hash"),
      },
      async (args) => {
        const result = await client.getDiff(args.projectKey, args.repoSlug, args.commitId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_list_webhooks",
      "List webhooks for a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
      },
      async (args) => {
        const result = await client.listWebhooks(args.projectKey, args.repoSlug);
        return textResult(result, scrubber);
      },
    );
  }

  // ── Write tools ─────────────────────────────────────────────────────

  if (shouldRegisterTool("bitbucket", "write", features)) {
    server.tool(
      "bitbucket_create_branch",
      "Create a new branch in a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        name: z.string().describe("Branch name"),
        startPoint: z.string().describe("Starting commit or branch"),
      },
      async (args) => {
        const result = await client.createBranch(args.projectKey, args.repoSlug, args.name, args.startPoint);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_delete_branch",
      "Delete a branch from a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        name: z.string().describe("Branch name"),
      },
      async (args) => {
        await client.deleteBranch(args.projectKey, args.repoSlug, args.name);
        return textResult({ success: true, deleted: args.name }, scrubber);
      },
    );

    server.tool(
      "bitbucket_create_pull_request",
      "Create a new pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        title: z.string().describe("Pull request title"),
        sourceBranch: z.string().describe("Source branch name"),
        targetBranch: z.string().describe("Target branch name"),
        description: z.string().optional().describe("Pull request description"),
      },
      async (args) => {
        const result = await client.createPullRequest(
          args.projectKey, args.repoSlug, args.title, args.sourceBranch, args.targetBranch, args.description,
        );
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_update_pull_request",
      "Update an existing pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
      },
      async (args) => {
        const result = await client.updatePullRequest(
          args.projectKey, args.repoSlug, args.prId, { title: args.title, description: args.description },
        );
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_merge_pull_request",
      "Merge a pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
      },
      async (args) => {
        await client.mergePullRequest(args.projectKey, args.repoSlug, args.prId);
        return textResult({ success: true, merged: args.prId }, scrubber);
      },
    );

    server.tool(
      "bitbucket_decline_pull_request",
      "Decline a pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
      },
      async (args) => {
        await client.declinePullRequest(args.projectKey, args.repoSlug, args.prId);
        return textResult({ success: true, declined: args.prId }, scrubber);
      },
    );

    server.tool(
      "bitbucket_add_pr_comment",
      "Add a comment to a Bitbucket pull request",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        prId: z.number().describe("Pull request ID"),
        text: z.string().describe("Comment text"),
      },
      async (args) => {
        const result = await client.addPrComment(args.projectKey, args.repoSlug, args.prId, args.text);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "bitbucket_create_webhook",
      "Create a webhook for a Bitbucket repository",
      {
        projectKey: z.string().describe("Project key"),
        repoSlug: z.string().describe("Repository slug"),
        name: z.string().describe("Webhook name"),
        url: z.string().describe("Webhook callback URL"),
        events: z.array(z.string()).describe("Events to listen for"),
      },
      async (args) => {
        const result = await client.createWebhook(
          args.projectKey, args.repoSlug, args.name, args.url, args.events,
        );
        return textResult(result, scrubber);
      },
    );
  }
}
