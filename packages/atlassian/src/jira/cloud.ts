import type { AtlassianFetch } from "../types.js";
import type {
  JiraClient,
  JiraIssue,
  JiraSearchResult,
  JiraComment,
  JiraTransition,
  JiraSprint,
  JiraBoard,
  JiraProject,
  JiraAttachment,
  JiraWorklog,
  JiraField,
  JiraPriority,
  JiraStatus,
  JiraIssueLink,
  JiraRemoteLink,
  JiraFieldMeta,
  JiraIssueType,
  JiraUser,
} from "./types.js";
import { adfToText, textToAdf } from "../adf.js";
import { throwAtlassianError } from "../errors.js";

export class JiraCloudClient implements JiraClient {
  constructor(private readonly fetch: AtlassianFetch) {}

  async searchIssues(jql: string, maxResults = 50): Promise<JiraSearchResult> {
    // Atlassian removed the legacy /rest/api/3/search endpoint in 2025.
    // The replacement /search/jql endpoint returns cursor-based pagination
    // and requires an explicit fields param — the default response includes only `id`.
    const fields = [
      "summary",
      "description",
      "status",
      "priority",
      "assignee",
      "reporter",
      "issuetype",
      "project",
      "created",
      "updated",
      "labels",
      "components",
      "fixVersions",
      "issuelinks",
    ].join(",");
    const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields });
    const res = await this.fetch(`/rest/api/3/search/jql?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search issues`);
    }
    const data = await res.json();
    return {
      issues: data.issues.map((raw: Record<string, unknown>) => this.normalizeIssue(raw)),
      nextPageToken: data.nextPageToken,
      isLast: data.isLast,
    };
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get issue ${issueKey}`);
    }
    const data = await res.json();
    return this.normalizeIssue(data);
  }

  async createIssue(
    projectKey: string,
    issueType: string,
    summary: string,
    description?: string,
    fields?: Record<string, unknown>,
  ): Promise<{ key: string; id: string }> {
    const body: Record<string, unknown> = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
        ...(description !== undefined ? { description: textToAdf(description) } : {}),
        ...fields,
      },
    };
    const res = await this.fetch("/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create issue`);
    }
    const data = await res.json();
    return { key: data.key, id: data.id };
  }

  async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to update issue ${issueKey}`);
    }
  }

  async deleteIssue(issueKey: string): Promise<void> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete issue ${issueKey}`);
    }
  }

  async getComments(issueKey: string): Promise<JiraComment[]> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/comment`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get comments for ${issueKey}`);
    }
    const data = await res.json();
    return data.comments.map((c: Record<string, unknown>) => this.normalizeComment(c));
  }

  async addComment(issueKey: string, body: string): Promise<JiraComment> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/comment`, {
      method: "POST",
      body: JSON.stringify({ body: textToAdf(body) }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add comment to ${issueKey}`);
    }
    const data = await res.json();
    return this.normalizeComment(data);
  }

  async updateComment(issueKey: string, commentId: string, body: string): Promise<JiraComment> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/comment/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ body: textToAdf(body) }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to update comment ${commentId}`);
    }
    const data = await res.json();
    return this.normalizeComment(data);
  }

  async deleteComment(issueKey: string, commentId: string): Promise<void> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/comment/${commentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete comment ${commentId}`);
    }
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/transitions`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get transitions for ${issueKey}`);
    }
    const data = await res.json();
    return data.transitions.map((t: Record<string, unknown>) => ({
      id: (t as { id: string }).id,
      name: (t as { name: string }).name,
      to: {
        id: ((t as { to: { id: string; name: string } }).to).id,
        name: ((t as { to: { id: string; name: string } }).to).name,
      },
    }));
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to transition issue ${issueKey}`);
    }
  }

  async assignIssue(issueKey: string, accountIdOrUsername: string | null): Promise<void> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/assignee`, {
      method: "PUT",
      body: JSON.stringify({ accountId: accountIdOrUsername }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to assign issue ${issueKey}`);
    }
  }

  async linkIssues(inwardKey: string, outwardKey: string, linkType: string): Promise<void> {
    const res = await this.fetch("/rest/api/3/issueLink", {
      method: "POST",
      body: JSON.stringify({
        type: { name: linkType },
        inwardIssue: { key: inwardKey },
        outwardIssue: { key: outwardKey },
      }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to link issues`);
    }
  }

  async listBoards(projectKey?: string): Promise<JiraBoard[]> {
    const params = projectKey ? `?projectKeyOrId=${projectKey}` : "";
    const res = await this.fetch(`/rest/agile/1.0/board${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list boards`);
    }
    const data = await res.json();
    return data.values.map((b: Record<string, unknown>) => ({
      id: (b as { id: number }).id,
      name: (b as { name: string }).name,
      type: (b as { type: string }).type,
      projectKey: ((b as { location?: { projectKey?: string } }).location)?.projectKey,
    }));
  }

  async getBoard(boardId: number): Promise<JiraBoard> {
    const res = await this.fetch(`/rest/agile/1.0/board/${boardId}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get board ${boardId}`);
    }
    const b = await res.json();
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      projectKey: b.location?.projectKey,
    };
  }

  async listSprints(boardId: number, state?: string): Promise<JiraSprint[]> {
    const params = state ? `?state=${state}` : "";
    const res = await this.fetch(`/rest/agile/1.0/board/${boardId}/sprint${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list sprints for board ${boardId}`);
    }
    const data = await res.json();
    return data.values.map((s: Record<string, unknown>) => ({
      id: (s as { id: number }).id,
      name: (s as { name: string }).name,
      state: (s as { state: string }).state,
      startDate: (s as { startDate?: string }).startDate,
      endDate: (s as { endDate?: string }).endDate,
      completeDate: (s as { completeDate?: string }).completeDate,
      boardId: (s as { originBoardId: number }).originBoardId ?? boardId,
    }));
  }

  async getSprintIssues(sprintId: number, maxResults = 50): Promise<JiraSearchResult> {
    const res = await this.fetch(`/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${maxResults}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get sprint ${sprintId} issues`);
    }
    const data = await res.json();
    return {
      issues: data.issues.map((raw: Record<string, unknown>) => this.normalizeIssue(raw)),
      total: data.total,
      maxResults: data.maxResults,
      startAt: data.startAt,
    };
  }

  async listProjects(): Promise<JiraProject[]> {
    const res = await this.fetch("/rest/api/3/project/search");
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list projects`);
    }
    const data = await res.json();
    return data.values.map((p: Record<string, unknown>) => ({
      id: (p as { id: string }).id,
      key: (p as { key: string }).key,
      name: (p as { name: string }).name,
      description: (p as { description?: string }).description,
      projectTypeKey: (p as { projectTypeKey: string }).projectTypeKey,
    }));
  }

  async listAttachments(issueKey: string): Promise<JiraAttachment[]> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}?fields=attachment`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list attachments for ${issueKey}`);
    }
    const data = await res.json();
    const attachments = data.fields?.attachment ?? [];
    return attachments.map((a: Record<string, unknown>) => this.normalizeAttachment(a));
  }

  async downloadAttachment(attachmentId: string): Promise<{ filename: string; content: Buffer }> {
    const metaRes = await this.fetch(`/rest/api/3/attachment/${attachmentId}`);
    if (!metaRes.ok) {
      await throwAtlassianError(metaRes, `Failed to get attachment metadata ${attachmentId}`);
    }
    const meta = await metaRes.json();
    const contentRes = await this.fetch(`/rest/api/3/attachment/content/${attachmentId}`);
    if (!contentRes.ok) {
      await throwAtlassianError(contentRes, `Failed to download attachment ${attachmentId}`);
    }
    const buffer = Buffer.from(await contentRes.arrayBuffer());
    return { filename: meta.filename, content: buffer };
  }

  async addAttachment(issueKey: string, filename: string, content: Buffer): Promise<JiraAttachment> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(content)]);
    formData.append("file", blob, filename);
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/attachments`, {
      method: "POST",
      body: formData,
      headers: { "X-Atlassian-Token": "no-check" },
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add attachment to ${issueKey}`);
    }
    const data = await res.json();
    return this.normalizeAttachment(data[0]);
  }

  async listWorklogs(issueKey: string): Promise<JiraWorklog[]> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/worklog`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list worklogs for ${issueKey}`);
    }
    const data = await res.json();
    return data.worklogs.map((w: Record<string, unknown>) => this.normalizeWorklog(w));
  }

  async addWorklog(
    issueKey: string,
    timeSpentSeconds: number,
    comment?: string,
    started?: string,
  ): Promise<JiraWorklog> {
    const body: Record<string, unknown> = { timeSpentSeconds };
    if (comment !== undefined) body.comment = textToAdf(comment);
    if (started !== undefined) body.started = started;
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/worklog`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add worklog to ${issueKey}`);
    }
    const data = await res.json();
    return this.normalizeWorklog(data);
  }

  async listFields(): Promise<JiraField[]> {
    const res = await this.fetch("/rest/api/3/field");
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list fields`);
    }
    const data = await res.json();
    return data.map((f: Record<string, unknown>) => ({
      id: (f as { id: string }).id,
      name: (f as { name: string }).name,
      custom: (f as { custom: boolean }).custom,
      schema: (f as { schema?: { type: string; system?: string } }).schema
        ? {
            type: ((f as { schema: { type: string } }).schema).type,
            system: ((f as { schema: { system?: string } }).schema).system,
          }
        : undefined,
    }));
  }

  async listPriorities(): Promise<JiraPriority[]> {
    const res = await this.fetch("/rest/api/3/priority");
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list priorities`);
    }
    const data = await res.json();
    return data.map((p: Record<string, unknown>) => ({
      id: (p as { id: string }).id,
      name: (p as { name: string }).name,
      iconUrl: (p as { iconUrl: string }).iconUrl,
    }));
  }

  async listStatuses(): Promise<JiraStatus[]> {
    const res = await this.fetch("/rest/api/3/status");
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list statuses`);
    }
    const data = await res.json();
    return data.map((s: Record<string, unknown>) => ({
      id: (s as { id: string }).id,
      name: (s as { name: string }).name,
      categoryKey: ((s as { statusCategory: { key: string } }).statusCategory).key,
    }));
  }

  async getRemoteIssueLinks(issueKey: string): Promise<JiraRemoteLink[]> {
    const res = await this.fetch(`/rest/api/3/issue/${issueKey}/remotelink`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get remote links for ${issueKey}`);
    }
    const data = await res.json();
    return data.map((r: Record<string, unknown>) => ({
      id: String((r as { id: number }).id),
      url: ((r as { object: { url: string } }).object).url,
      title: ((r as { object: { title: string } }).object).title,
      summary: ((r as { object: { summary?: string } }).object).summary,
    }));
  }

  async getIssueTypeFields(projectKey: string, issueTypeId: string): Promise<JiraFieldMeta[]> {
    const res = await this.fetch(`/rest/api/3/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get issue type fields for ${projectKey}/${issueTypeId}`);
    }
    const data = await res.json();
    const fields = data.fields ?? data.values ?? [];
    // Cloud createmeta returns fields as an object keyed by field ID
    if (!Array.isArray(fields)) {
      return Object.entries(fields).map(([fieldId, meta]: [string, any]) => ({
        fieldId,
        name: meta.name ?? fieldId,
        required: meta.required ?? false,
        schema: { type: meta.schema?.type ?? "string" },
      }));
    }
    return fields.map((f: any) => ({
      fieldId: f.fieldId ?? f.key ?? "",
      name: f.name ?? "",
      required: f.required ?? false,
      schema: { type: f.schema?.type ?? "string" },
    }));
  }

  async getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const res = await this.fetch(`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get issue types for project ${projectKey}`);
    }
    const data = await res.json();
    const issueTypes = data.issueTypes ?? data.values ?? data;
    return (Array.isArray(issueTypes) ? issueTypes : []).map((t: any) => ({
      id: t.id ?? "",
      name: t.name ?? "",
      description: t.description,
      subtask: t.subtask ?? false,
    }));
  }

  async findUsers(query: string): Promise<JiraUser[]> {
    const params = new URLSearchParams({ query });
    const res = await this.fetch(`/rest/api/3/user/search?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search users`);
    }
    const data = await res.json();
    return data.map((u: any) => ({
      accountId: u.accountId ?? "",
      displayName: u.displayName ?? "",
      emailAddress: u.emailAddress,
      active: u.active ?? true,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeIssue(raw: any): JiraIssue {
    const fields = raw.fields ?? {};
    return {
      key: raw.key,
      id: raw.id,
      summary: fields.summary ?? "",
      description: fields.description ? adfToText(fields.description).trim() || null : null,
      status: fields.status?.name ?? "",
      priority: fields.priority?.name ?? null,
      assignee: fields.assignee?.accountId ?? null,
      reporter: fields.reporter?.accountId ?? null,
      issueType: fields.issuetype?.name ?? "",
      projectKey: fields.project?.key ?? "",
      created: fields.created ?? "",
      updated: fields.updated ?? "",
      labels: fields.labels ?? [],
      components: (fields.components ?? []).map((c: { name: string }) => c.name),
      fixVersions: (fields.fixVersions ?? []).map((v: { name: string }) => v.name),
      links: (fields.issuelinks ?? []).map((l: Record<string, unknown>) => this.normalizeLink(l)),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeComment(raw: any): JiraComment {
    return {
      id: raw.id,
      body: raw.body ? (typeof raw.body === "string" ? raw.body : adfToText(raw.body).trim()) : "",
      author: raw.author?.accountId ?? raw.author?.displayName ?? "",
      created: raw.created ?? "",
      updated: raw.updated ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeAttachment(raw: any): JiraAttachment {
    return {
      id: raw.id,
      filename: raw.filename,
      size: raw.size,
      mimeType: raw.mimeType,
      created: raw.created,
      author: raw.author?.accountId ?? raw.author?.displayName ?? "",
      contentUrl: raw.content,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeWorklog(raw: any): JiraWorklog {
    return {
      id: raw.id,
      issueId: raw.issueId,
      author: raw.author?.accountId ?? raw.author?.displayName ?? "",
      timeSpentSeconds: raw.timeSpentSeconds,
      comment: raw.comment
        ? (typeof raw.comment === "string" ? raw.comment : adfToText(raw.comment).trim() || null)
        : null,
      started: raw.started ?? "",
      created: raw.created ?? "",
      updated: raw.updated ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeLink(raw: any): JiraIssueLink {
    return {
      id: raw.id,
      type: raw.type?.name ?? "",
      inwardIssue: raw.inwardIssue?.key,
      outwardIssue: raw.outwardIssue?.key,
    };
  }
}
