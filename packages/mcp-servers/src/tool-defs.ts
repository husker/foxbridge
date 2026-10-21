import type { FoxbridgeConfig } from "@foxbridge/config";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  product: "jira" | "confluence" | "bitbucket" | "assets";
  operation: "read" | "write";
}

export const ALL_TOOLS: ToolDefinition[] = [
  // ── Jira Read ──────────────────────────────────────────────────────────
  {
    name: "jira_search_issues",
    description: "Search Jira issues using JQL",
    inputSchema: {
      type: "object",
      properties: {
        jql: { type: "string", description: "JQL query string" },
        maxResults: { type: "number", description: "Maximum number of results to return" },
      },
      required: ["jql"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_read_issue",
    description: "Read a single Jira issue by key",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_comments",
    description: "List comments on a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_transitions",
    description: "List available transitions for a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_boards",
    description: "List Jira agile boards",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Filter by project key" },
      },
      required: [],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_sprints",
    description: "List sprints for a Jira board",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "number", description: "Board ID" },
        state: { type: "string", description: "Filter by state (active, closed, future)" },
      },
      required: ["boardId"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_get_sprint_issues",
    description: "Get issues in a Jira sprint",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "number", description: "Sprint ID" },
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: ["sprintId"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_projects",
    description: "List all Jira projects",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_attachments",
    description: "List attachments on a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_download_attachment",
    description: "Download a Jira attachment by ID",
    inputSchema: {
      type: "object",
      properties: {
        attachmentId: { type: "string", description: "Attachment ID" },
      },
      required: ["attachmentId"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_worklogs",
    description: "List worklogs on a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_fields",
    description: "List all Jira fields (system and custom)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_priorities",
    description: "List all Jira priority levels",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_list_statuses",
    description: "List all Jira statuses",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    product: "jira",
    operation: "read",
  },

  {
    name: "jira_get_remote_links",
    description: "Get remote issue links for a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_get_issue_type_fields",
    description: "Get the fields required to create an issue of a specific type in a project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key (e.g. PROJ)" },
        issueTypeId: { type: "string", description: "Issue type ID" },
      },
      required: ["projectKey", "issueTypeId"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_get_project_issue_types",
    description: "Get the available issue types for a Jira project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key (e.g. PROJ)" },
      },
      required: ["projectKey"],
    },
    product: "jira",
    operation: "read",
  },
  {
    name: "jira_find_users",
    description: "Search for Jira users by name or email",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (name or email)" },
      },
      required: ["query"],
    },
    product: "jira",
    operation: "read",
  },

  // ── Jira Write ─────────────────────────────────────────────────────────
  {
    name: "jira_create_issue",
    description: "Create a new Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key (e.g. PROJ)" },
        issueType: { type: "string", description: "Issue type (e.g. Bug, Story, Task)" },
        summary: { type: "string", description: "Issue summary" },
        description: { type: "string", description: "Issue description" },
        fields: { type: "object", description: "Additional fields" },
      },
      required: ["projectKey", "issueType", "summary"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_update_issue",
    description: "Update an existing Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        fields: { type: "object", description: "Fields to update" },
      },
      required: ["issueKey", "fields"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_delete_issue",
    description: "Delete a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
      },
      required: ["issueKey"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_add_comment",
    description: "Add a comment to a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        body: { type: "string", description: "Comment body" },
      },
      required: ["issueKey", "body"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_update_comment",
    description: "Update a comment on a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        commentId: { type: "string", description: "Comment ID" },
        body: { type: "string", description: "Updated comment body" },
      },
      required: ["issueKey", "commentId", "body"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_delete_comment",
    description: "Delete a comment from a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        commentId: { type: "string", description: "Comment ID" },
      },
      required: ["issueKey", "commentId"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_transition_issue",
    description: "Transition a Jira issue to a new status",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        transitionId: { type: "string", description: "Transition ID" },
      },
      required: ["issueKey", "transitionId"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_assign_issue",
    description: "Assign a Jira issue to a user",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        accountIdOrUsername: { type: ["string", "null"], description: "Account ID (Cloud) or username (DC), null to unassign" },
      },
      required: ["issueKey", "accountIdOrUsername"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_link_issues",
    description: "Create a link between two Jira issues",
    inputSchema: {
      type: "object",
      properties: {
        inwardKey: { type: "string", description: "Inward issue key" },
        outwardKey: { type: "string", description: "Outward issue key" },
        linkType: { type: "string", description: "Link type (e.g. Blocks, Duplicate)" },
      },
      required: ["inwardKey", "outwardKey", "linkType"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_add_attachment",
    description: "Add an attachment to a Jira issue (base64 encoded content)",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        filename: { type: "string", description: "File name" },
        contentBase64: { type: "string", description: "Base64-encoded file content" },
      },
      required: ["issueKey", "filename", "contentBase64"],
    },
    product: "jira",
    operation: "write",
  },
  {
    name: "jira_add_worklog",
    description: "Add a worklog entry to a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string", description: "Issue key (e.g. PROJ-123)" },
        timeSpentSeconds: { type: "number", description: "Time spent in seconds" },
        comment: { type: "string", description: "Worklog comment" },
        started: { type: "string", description: "Start time (ISO 8601)" },
      },
      required: ["issueKey", "timeSpentSeconds"],
    },
    product: "jira",
    operation: "write",
  },

  // ── Confluence Read ────────────────────────────────────────────────────
  {
    name: "confluence_search",
    description: "Search Confluence using CQL",
    inputSchema: {
      type: "object",
      properties: {
        cql: { type: "string", description: "CQL query string" },
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: ["cql"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_read_page",
    description: "Read a Confluence page by ID",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_list_spaces",
    description: "List Confluence spaces",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: [],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_list_labels",
    description: "List labels on a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_list_attachments",
    description: "List attachments on a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_download_attachment",
    description: "Download a Confluence attachment by URL",
    inputSchema: {
      type: "object",
      properties: {
        downloadUrl: { type: "string", description: "Download URL from list_attachments" },
      },
      required: ["downloadUrl"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_list_comments",
    description: "List comments on a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_get_content_property",
    description: "Get a content property from a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        key: { type: "string", description: "Property key" },
      },
      required: ["pageId", "key"],
    },
    product: "confluence",
    operation: "read",
  },

  {
    name: "confluence_list_inline_comments",
    description: "List inline comments on a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_get_page_children",
    description: "Get child pages of a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "read",
  },
  {
    name: "confluence_list_space_pages",
    description: "List pages in a Confluence space",
    inputSchema: {
      type: "object",
      properties: {
        spaceKey: { type: "string", description: "Space key" },
        maxResults: { type: "number", description: "Maximum number of results" },
        title: { type: "string", description: "Filter by page title" },
      },
      required: ["spaceKey"],
    },
    product: "confluence",
    operation: "read",
  },

  // ── Confluence Write ───────────────────────────────────────────────────
  {
    name: "confluence_add_inline_comment",
    description: "Add an inline comment to a Confluence page anchored to specific text",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        body: { type: "string", description: "Comment body (storage format HTML)" },
        selectionText: { type: "string", description: "The text in the page to anchor the comment to" },
      },
      required: ["pageId", "body", "selectionText"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_create_page",
    description: "Create a new Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        spaceKey: { type: "string", description: "Space key" },
        title: { type: "string", description: "Page title" },
        body: { type: "string", description: "Page body (storage format HTML)" },
        parentId: { type: "string", description: "Parent page ID" },
      },
      required: ["spaceKey", "title", "body"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_update_page",
    description: "Update an existing Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        title: { type: "string", description: "Page title" },
        body: { type: "string", description: "Page body (storage format HTML)" },
        version: { type: "number", description: "Current version number (for optimistic locking)" },
      },
      required: ["pageId", "title", "body", "version"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_delete_page",
    description: "Delete a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_add_label",
    description: "Add a label to a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        label: { type: "string", description: "Label name" },
      },
      required: ["pageId", "label"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_remove_label",
    description: "Remove a label from a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        label: { type: "string", description: "Label name" },
      },
      required: ["pageId", "label"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_add_attachment",
    description: "Add an attachment to a Confluence page (base64 encoded content)",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        filename: { type: "string", description: "File name" },
        contentBase64: { type: "string", description: "Base64-encoded file content" },
      },
      required: ["pageId", "filename", "contentBase64"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_add_comment",
    description: "Add a comment to a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        body: { type: "string", description: "Comment body" },
      },
      required: ["pageId", "body"],
    },
    product: "confluence",
    operation: "write",
  },
  {
    name: "confluence_set_content_property",
    description: "Set a content property on a Confluence page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "Page ID" },
        key: { type: "string", description: "Property key" },
        value: { description: "Property value (JSON)" },
      },
      required: ["pageId", "key", "value"],
    },
    product: "confluence",
    operation: "write",
  },

  // ── Bitbucket Read ─────────────────────────────────────────────────────
  {
    name: "bitbucket_list_repos",
    description: "List Bitbucket repositories in a project",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
      },
      required: ["projectKey"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_browse_files",
    description: "Browse files in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        path: { type: "string", description: "Path within the repository" },
        ref: { type: "string", description: "Branch, tag, or commit reference" },
      },
      required: ["projectKey", "repoSlug"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_read_file",
    description: "Read the content of a file in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        filePath: { type: "string", description: "Path to the file" },
        ref: { type: "string", description: "Branch, tag, or commit reference" },
      },
      required: ["projectKey", "repoSlug", "filePath"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_search_code",
    description: "Search code in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        query: { type: "string", description: "Search query" },
      },
      required: ["projectKey", "repoSlug", "query"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_list_branches",
    description: "List branches in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
      },
      required: ["projectKey", "repoSlug"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_list_pull_requests",
    description: "List pull requests in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        state: { type: "string", description: "Filter by state (OPEN, MERGED, DECLINED)" },
      },
      required: ["projectKey", "repoSlug"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_read_pull_request",
    description: "Read a single pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
      },
      required: ["projectKey", "repoSlug", "prId"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_list_pr_comments",
    description: "List comments on a Bitbucket pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
      },
      required: ["projectKey", "repoSlug", "prId"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_list_commits",
    description: "List commits in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        ref: { type: "string", description: "Branch, tag, or commit reference" },
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: ["projectKey", "repoSlug"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_get_commit",
    description: "Get details of a single commit",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        commitId: { type: "string", description: "Commit hash" },
      },
      required: ["projectKey", "repoSlug", "commitId"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_get_diff",
    description: "Get the diff of a commit",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        commitId: { type: "string", description: "Commit hash" },
      },
      required: ["projectKey", "repoSlug", "commitId"],
    },
    product: "bitbucket",
    operation: "read",
  },
  {
    name: "bitbucket_list_webhooks",
    description: "List webhooks for a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
      },
      required: ["projectKey", "repoSlug"],
    },
    product: "bitbucket",
    operation: "read",
  },

  // ── Bitbucket Write ────────────────────────────────────────────────────
  {
    name: "bitbucket_create_branch",
    description: "Create a new branch in a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        name: { type: "string", description: "Branch name" },
        startPoint: { type: "string", description: "Starting commit or branch" },
      },
      required: ["projectKey", "repoSlug", "name", "startPoint"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_delete_branch",
    description: "Delete a branch from a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        name: { type: "string", description: "Branch name" },
      },
      required: ["projectKey", "repoSlug", "name"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_create_pull_request",
    description: "Create a new pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        title: { type: "string", description: "Pull request title" },
        sourceBranch: { type: "string", description: "Source branch name" },
        targetBranch: { type: "string", description: "Target branch name" },
        description: { type: "string", description: "Pull request description" },
      },
      required: ["projectKey", "repoSlug", "title", "sourceBranch", "targetBranch"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_update_pull_request",
    description: "Update an existing pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
      },
      required: ["projectKey", "repoSlug", "prId"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_merge_pull_request",
    description: "Merge a pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
      },
      required: ["projectKey", "repoSlug", "prId"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_decline_pull_request",
    description: "Decline a pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
      },
      required: ["projectKey", "repoSlug", "prId"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_add_pr_comment",
    description: "Add a comment to a Bitbucket pull request",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        prId: { type: "number", description: "Pull request ID" },
        text: { type: "string", description: "Comment text" },
      },
      required: ["projectKey", "repoSlug", "prId", "text"],
    },
    product: "bitbucket",
    operation: "write",
  },
  {
    name: "bitbucket_create_webhook",
    description: "Create a webhook for a Bitbucket repository",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", description: "Project key" },
        repoSlug: { type: "string", description: "Repository slug" },
        name: { type: "string", description: "Webhook name" },
        url: { type: "string", description: "Webhook callback URL" },
        events: { type: "array", items: { type: "string" }, description: "Events to listen for" },
      },
      required: ["projectKey", "repoSlug", "name", "url", "events"],
    },
    product: "bitbucket",
    operation: "write",
  },

  // ── Assets Read (Insight — DC only) ───────────────────────────────────
  {
    name: "assets_search",
    description: "Search Jira Assets / Insight objects using AQL (Assets Query Language)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "AQL query string (e.g. 'objectType = Server')" },
        schemaId: { type: "number", description: "Limit search to a specific schema ID" },
        page: { type: "number", description: "Page number (default 1)" },
        resultsPerPage: { type: "number", description: "Results per page (default 25)" },
      },
      required: ["query"],
    },
    product: "assets",
    operation: "read",
  },
  {
    name: "assets_get_object",
    description: "Get a single Jira Assets / Insight object by ID",
    inputSchema: {
      type: "object",
      properties: {
        objectId: { type: "number", description: "Object ID" },
      },
      required: ["objectId"],
    },
    product: "assets",
    operation: "read",
  },
  {
    name: "assets_get_object_history",
    description: "Get the change history of a Jira Assets / Insight object",
    inputSchema: {
      type: "object",
      properties: {
        objectId: { type: "number", description: "Object ID" },
      },
      required: ["objectId"],
    },
    product: "assets",
    operation: "read",
  },
  {
    name: "assets_get_connected_tickets",
    description: "Get Jira issues linked to a Jira Assets / Insight object",
    inputSchema: {
      type: "object",
      properties: {
        objectId: { type: "number", description: "Object ID" },
      },
      required: ["objectId"],
    },
    product: "assets",
    operation: "read",
  },
  {
    name: "assets_list_schemas",
    description: "List all Jira Assets / Insight object schemas",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    product: "assets",
    operation: "read",
  },
  {
    name: "assets_list_object_types",
    description: "List object types in a Jira Assets / Insight schema",
    inputSchema: {
      type: "object",
      properties: {
        schemaId: { type: "number", description: "Schema ID" },
      },
      required: ["schemaId"],
    },
    product: "assets",
    operation: "read",
  },
];

/**
 * Filter tool definitions by feature toggles from config.
 */
export function getToolDefinitions(config: FoxbridgeConfig): ToolDefinition[] {
  return ALL_TOOLS.filter((tool) => {
    const feature = (config.features as Record<string, { read: boolean; write: boolean } | undefined>)[tool.product];
    if (!feature) return false;
    return feature[tool.operation];
  });
}

/**
 * Map tool definitions to Anthropic tool format.
 */
export function toAnthropicTools(
  defs: ToolDefinition[],
): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.inputSchema,
  }));
}

/**
 * Map tool definitions to OpenAI tool format.
 */
export function toOpenAITools(
  defs: ToolDefinition[],
): Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.inputSchema,
    },
  }));
}
