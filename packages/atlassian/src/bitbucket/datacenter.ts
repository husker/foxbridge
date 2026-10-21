import type { AtlassianFetch } from "../types.js";
import { throwAtlassianError } from "../errors.js";
import type {
  BitbucketClient,
  BitbucketRepo,
  BitbucketFile,
  BitbucketBranch,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPrComment,
  BitbucketWebhook,
} from "./types.js";

export class BitbucketDataCenterClient implements BitbucketClient {
  constructor(private readonly fetch: AtlassianFetch) {}

  async listRepos(projectKey: string): Promise<BitbucketRepo[]> {
    const res = await this.fetch(`/rest/api/1.0/projects/${projectKey}/repos`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list repos`);
    }
    const data = await res.json();
    return data.values.map((r: Record<string, unknown>) => this.normalizeRepo(r, projectKey));
  }

  async browseFiles(projectKey: string, repoSlug: string, path?: string, ref?: string): Promise<BitbucketFile[]> {
    const filePath = path ? `/${path}` : "";
    const params = ref ? `?at=${encodeURIComponent(ref)}` : "";
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/browse${filePath}${params}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to browse files`);
    }
    const data = await res.json();
    return (data.children?.values ?? []).map((f: Record<string, unknown>) => ({
      path: (f as { path: { toString: string } }).path?.toString ?? (f as { path: string }).path,
      type: (f as { type: string }).type === "FILE" ? "file" as const : "directory" as const,
      size: (f as { size?: number }).size,
    }));
  }

  async readFile(projectKey: string, repoSlug: string, filePath: string, ref?: string): Promise<string> {
    const params = ref ? `?at=${encodeURIComponent(ref)}` : "";
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/raw/${filePath}${params}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to read file`);
    }
    return res.text();
  }

  async listBranches(projectKey: string, repoSlug: string): Promise<BitbucketBranch[]> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/branches`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list branches`);
    }
    const data = await res.json();
    return data.values.map((b: Record<string, unknown>) => ({
      name: (b as { displayId: string }).displayId,
      latestCommit: (b as { latestCommit: string }).latestCommit,
      isDefault: (b as { isDefault: boolean }).isDefault ?? false,
    }));
  }

  async createBranch(projectKey: string, repoSlug: string, name: string, startPoint: string): Promise<BitbucketBranch> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/branches`,
      {
        method: "POST",
        body: JSON.stringify({ name, startPoint }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create branch`);
    }
    const b = await res.json();
    return {
      name: b.displayId ?? b.name ?? name,
      latestCommit: b.latestCommit ?? startPoint,
      isDefault: b.isDefault ?? false,
    };
  }

  async deleteBranch(projectKey: string, repoSlug: string, name: string): Promise<void> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/branches`,
      {
        method: "DELETE",
        body: JSON.stringify({ name, dryRun: false }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete branch`);
    }
  }

  async listPullRequests(projectKey: string, repoSlug: string, state?: string): Promise<BitbucketPullRequest[]> {
    const params = state ? `?state=${encodeURIComponent(state)}` : "";
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests${params}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list pull requests`);
    }
    const data = await res.json();
    return data.values.map((pr: Record<string, unknown>) => this.normalizePullRequest(pr));
  }

  async getPullRequest(projectKey: string, repoSlug: string, prId: number): Promise<BitbucketPullRequest> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get pull request ${prId}`);
    }
    const data = await res.json();
    return this.normalizePullRequest(data);
  }

  async createPullRequest(
    projectKey: string,
    repoSlug: string,
    title: string,
    sourceBranch: string,
    targetBranch: string,
    description?: string,
  ): Promise<BitbucketPullRequest> {
    const body = {
      title,
      description: description ?? "",
      fromRef: { id: `refs/heads/${sourceBranch}` },
      toRef: { id: `refs/heads/${targetBranch}` },
    };
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create pull request`);
    }
    const data = await res.json();
    return this.normalizePullRequest(data);
  }

  async updatePullRequest(
    projectKey: string,
    repoSlug: string,
    prId: number,
    fields: { title?: string; description?: string },
  ): Promise<BitbucketPullRequest> {
    // Fetch current PR raw to obtain the version for optimistic locking
    const currentRes = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}`,
    );
    if (!currentRes.ok) {
      await throwAtlassianError(currentRes, `Failed to get pull request ${prId} for update`);
    }
    const currentData = await currentRes.json();
    const body: Record<string, unknown> = {
      version: (currentData as { version?: number }).version ?? 0,
      ...fields,
    };
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to update pull request ${prId}`);
    }
    const data = await res.json();
    return this.normalizePullRequest(data);
  }

  async mergePullRequest(projectKey: string, repoSlug: string, prId: number): Promise<void> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/merge`,
      { method: "POST" },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to merge pull request ${prId}`);
    }
  }

  async declinePullRequest(projectKey: string, repoSlug: string, prId: number): Promise<void> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/decline`,
      { method: "POST" },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to decline pull request ${prId}`);
    }
  }

  async listPrComments(projectKey: string, repoSlug: string, prId: number): Promise<BitbucketPrComment[]> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/comments`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list PR comments`);
    }
    const data = await res.json();
    return data.values.map((c: Record<string, unknown>) => this.normalizeComment(c));
  }

  async addPrComment(projectKey: string, repoSlug: string, prId: number, text: string): Promise<BitbucketPrComment> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add PR comment`);
    }
    const data = await res.json();
    return this.normalizeComment(data);
  }

  async listCommits(projectKey: string, repoSlug: string, ref?: string, maxResults?: number): Promise<BitbucketCommit[]> {
    const params: string[] = [];
    if (ref) params.push(`until=${encodeURIComponent(ref)}`);
    if (maxResults) params.push(`limit=${maxResults}`);
    const query = params.length > 0 ? `?${params.join("&")}` : "";
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/commits${query}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list commits`);
    }
    const data = await res.json();
    return data.values.map((c: Record<string, unknown>) => this.normalizeCommit(c));
  }

  async getCommit(projectKey: string, repoSlug: string, commitId: string): Promise<BitbucketCommit> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/commits/${commitId}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get commit ${commitId}`);
    }
    const data = await res.json();
    return this.normalizeCommit(data);
  }

  async getDiff(projectKey: string, repoSlug: string, commitId: string): Promise<string> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/commits/${commitId}/diff`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get diff`);
    }
    const data = await res.json();
    // DC returns JSON with diffs array containing hunks — extract text
    const lines: string[] = [];
    for (const diff of data.diffs ?? []) {
      for (const hunk of diff.hunks ?? []) {
        for (const segment of hunk.segments ?? []) {
          for (const line of segment.lines ?? []) {
            const prefix = segment.type === "ADDED" ? "+" : segment.type === "REMOVED" ? "-" : " ";
            lines.push(`${prefix}${line.line}`);
          }
        }
      }
    }
    return lines.join("\n");
  }

  async searchCode(projectKey: string, repoSlug: string, query: string): Promise<{ file: string; matches: string[] }[]> {
    const params = `?query=${encodeURIComponent(query)}&projectKey=${encodeURIComponent(projectKey)}&repoSlug=${encodeURIComponent(repoSlug)}`;
    const res = await this.fetch(`/rest/search/1.0/search${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search code`);
    }
    const data = await res.json();
    return (data.values ?? []).map((r: Record<string, unknown>) => ({
      file: ((r as { file?: { path?: string } }).file?.path) ?? "",
      matches: ((r as { hitContexts?: Array<{ context?: string }> }).hitContexts ?? []).map(
        (h: { context?: string }) => h.context ?? "",
      ),
    }));
  }

  async listWebhooks(projectKey: string, repoSlug: string): Promise<BitbucketWebhook[]> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/webhooks`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list webhooks`);
    }
    const data = await res.json();
    return data.values.map((w: Record<string, unknown>) => this.normalizeWebhook(w));
  }

  async createWebhook(
    projectKey: string,
    repoSlug: string,
    name: string,
    url: string,
    events: string[],
  ): Promise<BitbucketWebhook> {
    const res = await this.fetch(
      `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/webhooks`,
      {
        method: "POST",
        body: JSON.stringify({ name, url, events, active: true }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create webhook`);
    }
    const data = await res.json();
    return this.normalizeWebhook(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeRepo(raw: any, projectKey: string): BitbucketRepo {
    return {
      slug: raw.slug,
      name: raw.name,
      projectKey,
      description: raw.description ?? "",
      defaultBranch: raw.defaultBranch ?? null,
      isPublic: raw.public ?? false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizePullRequest(raw: any): BitbucketPullRequest {
    return {
      id: raw.id,
      title: raw.title ?? "",
      description: raw.description ?? "",
      state: raw.state ?? "",
      author: raw.author?.user?.name ?? raw.author?.user?.displayName ?? "",
      sourceBranch: raw.fromRef?.displayId ?? "",
      targetBranch: raw.toRef?.displayId ?? "",
      created: raw.createdDate ? new Date(raw.createdDate).toISOString() : "",
      updated: raw.updatedDate ? new Date(raw.updatedDate).toISOString() : "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeComment(raw: any): BitbucketPrComment {
    return {
      id: raw.id,
      text: raw.text ?? "",
      author: raw.author?.name ?? raw.author?.displayName ?? "",
      created: raw.createdDate ? new Date(raw.createdDate).toISOString() : "",
      updated: raw.updatedDate ? new Date(raw.updatedDate).toISOString() : "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeCommit(raw: any): BitbucketCommit {
    return {
      id: raw.id,
      message: raw.message ?? "",
      author: raw.author?.name ?? raw.author?.displayName ?? "",
      authorTimestamp: raw.authorTimestamp ? new Date(raw.authorTimestamp).toISOString() : "",
      parents: (raw.parents ?? []).map((p: { id: string }) => p.id),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeWebhook(raw: any): BitbucketWebhook {
    return {
      id: raw.id,
      name: raw.name ?? "",
      url: raw.url ?? "",
      events: raw.events ?? [],
      active: raw.active ?? true,
    };
  }
}
