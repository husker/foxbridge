import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxbridgeConfig } from "@foxbridge/config";
import {
  createAtlassianFetch,
  createJiraClient,
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

export function registerJiraTools(
  server: McpServer,
  config: FoxbridgeConfig,
  credentials: UserCredentials,
  scrubber: PiiScrubber | null,
): void {
  const jiraUrl = config.atlassian.jira_url ?? config.atlassian.base_url;
  const fetch = createAtlassianFetch(jiraUrl, config.atlassian.platform, credentials, config.atlassian.auth_method);
  const client = createJiraClient(fetch, config.atlassian.platform);
  const features = config.features;

  // ── Read tools ──────────────────────────────────────────────────────

  if (shouldRegisterTool("jira", "read", features)) {
    server.tool(
      "jira_search_issues",
      "Search Jira issues using JQL",
      {
        jql: z.string().describe("JQL query string"),
        maxResults: z.number().optional().describe("Maximum number of results to return"),
      },
      async (args) => {
        const result = await client.searchIssues(args.jql, args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_read_issue",
      "Read a single Jira issue by key",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.getIssue(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_comments",
      "List comments on a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.getComments(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_transitions",
      "List available transitions for a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.getTransitions(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_boards",
      "List Jira agile boards",
      {
        projectKey: z.string().optional().describe("Filter by project key"),
      },
      async (args) => {
        const result = await client.listBoards(args.projectKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_sprints",
      "List sprints for a Jira board",
      {
        boardId: z.number().describe("Board ID"),
        state: z.string().optional().describe("Filter by state (active, closed, future)"),
      },
      async (args) => {
        const result = await client.listSprints(args.boardId, args.state);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_get_sprint_issues",
      "Get issues in a Jira sprint",
      {
        sprintId: z.number().describe("Sprint ID"),
        maxResults: z.number().optional().describe("Maximum number of results"),
      },
      async (args) => {
        const result = await client.getSprintIssues(args.sprintId, args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_projects",
      "List all Jira projects",
      {},
      async () => {
        const result = await client.listProjects();
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_attachments",
      "List attachments on a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.listAttachments(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_download_attachment",
      "Download a Jira attachment by ID",
      {
        attachmentId: z.string().describe("Attachment ID"),
      },
      async (args) => {
        const result = await client.downloadAttachment(args.attachmentId);
        return {
          content: [{ type: "text" as const, text: fmt({ filename: result.filename, size: result.content.length }, scrubber) }],
        };
      },
    );

    server.tool(
      "jira_list_worklogs",
      "List worklogs on a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.listWorklogs(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_fields",
      "List all Jira fields (system and custom)",
      {},
      async () => {
        const result = await client.listFields();
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_priorities",
      "List all Jira priority levels",
      {},
      async () => {
        const result = await client.listPriorities();
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_list_statuses",
      "List all Jira statuses",
      {},
      async () => {
        const result = await client.listStatuses();
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_get_remote_links",
      "Get remote issue links for a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        const result = await client.getRemoteIssueLinks(args.issueKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_get_issue_type_fields",
      "Get the fields required to create an issue of a specific type in a project",
      {
        projectKey: z.string().describe("Project key (e.g. PROJ)"),
        issueTypeId: z.string().describe("Issue type ID"),
      },
      async (args) => {
        const result = await client.getIssueTypeFields(args.projectKey, args.issueTypeId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_get_project_issue_types",
      "Get the available issue types for a Jira project",
      {
        projectKey: z.string().describe("Project key (e.g. PROJ)"),
      },
      async (args) => {
        const result = await client.getProjectIssueTypes(args.projectKey);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_find_users",
      "Search for Jira users by name or email",
      {
        query: z.string().describe("Search query (name or email)"),
      },
      async (args) => {
        const result = await client.findUsers(args.query);
        return textResult(result, scrubber);
      },
    );
  }

  // ── Write tools ─────────────────────────────────────────────────────

  if (shouldRegisterTool("jira", "write", features)) {
    server.tool(
      "jira_create_issue",
      "Create a new Jira issue",
      {
        projectKey: z.string().describe("Project key (e.g. PROJ)"),
        issueType: z.string().describe("Issue type (e.g. Bug, Story, Task)"),
        summary: z.string().describe("Issue summary"),
        description: z.string().optional().describe("Issue description"),
        fields: z.record(z.unknown()).optional().describe("Additional fields"),
      },
      async (args) => {
        const result = await client.createIssue(
          args.projectKey, args.issueType, args.summary, args.description, args.fields,
        );
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_update_issue",
      "Update an existing Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        fields: z.record(z.unknown()).describe("Fields to update"),
      },
      async (args) => {
        await client.updateIssue(args.issueKey, args.fields);
        return textResult({ success: true, issueKey: args.issueKey }, scrubber);
      },
    );

    server.tool(
      "jira_delete_issue",
      "Delete a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
      },
      async (args) => {
        await client.deleteIssue(args.issueKey);
        return textResult({ success: true, deleted: args.issueKey }, scrubber);
      },
    );

    server.tool(
      "jira_add_comment",
      "Add a comment to a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        body: z.string().describe("Comment body"),
      },
      async (args) => {
        const result = await client.addComment(args.issueKey, args.body);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_update_comment",
      "Update a comment on a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        commentId: z.string().describe("Comment ID"),
        body: z.string().describe("Updated comment body"),
      },
      async (args) => {
        const result = await client.updateComment(args.issueKey, args.commentId, args.body);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_delete_comment",
      "Delete a comment from a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        commentId: z.string().describe("Comment ID"),
      },
      async (args) => {
        await client.deleteComment(args.issueKey, args.commentId);
        return textResult({ success: true, deleted: args.commentId }, scrubber);
      },
    );

    server.tool(
      "jira_transition_issue",
      "Transition a Jira issue to a new status",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        transitionId: z.string().describe("Transition ID"),
      },
      async (args) => {
        await client.transitionIssue(args.issueKey, args.transitionId);
        return textResult({ success: true, issueKey: args.issueKey }, scrubber);
      },
    );

    server.tool(
      "jira_assign_issue",
      "Assign a Jira issue to a user",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        accountIdOrUsername: z.string().nullable().describe("Account ID (Cloud) or username (DC), null to unassign"),
      },
      async (args) => {
        await client.assignIssue(args.issueKey, args.accountIdOrUsername);
        return textResult({ success: true, issueKey: args.issueKey }, scrubber);
      },
    );

    server.tool(
      "jira_link_issues",
      "Create a link between two Jira issues",
      {
        inwardKey: z.string().describe("Inward issue key"),
        outwardKey: z.string().describe("Outward issue key"),
        linkType: z.string().describe("Link type (e.g. Blocks, Duplicate)"),
      },
      async (args) => {
        await client.linkIssues(args.inwardKey, args.outwardKey, args.linkType);
        return textResult({ success: true }, scrubber);
      },
    );

    server.tool(
      "jira_add_attachment",
      "Add an attachment to a Jira issue (base64 encoded content)",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        filename: z.string().describe("File name"),
        contentBase64: z.string().describe("Base64-encoded file content"),
      },
      async (args) => {
        const content = Buffer.from(args.contentBase64, "base64");
        const result = await client.addAttachment(args.issueKey, args.filename, content);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "jira_add_worklog",
      "Add a worklog entry to a Jira issue",
      {
        issueKey: z.string().describe("Issue key (e.g. PROJ-123)"),
        timeSpentSeconds: z.number().describe("Time spent in seconds"),
        comment: z.string().optional().describe("Worklog comment"),
        started: z.string().optional().describe("Start time (ISO 8601)"),
      },
      async (args) => {
        const result = await client.addWorklog(
          args.issueKey, args.timeSpentSeconds, args.comment, args.started,
        );
        return textResult(result, scrubber);
      },
    );
  }
}
