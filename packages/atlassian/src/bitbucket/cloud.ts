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

export class BitbucketCloudClient implements BitbucketClient {
  constructor(private readonly fetch: AtlassianFetch) {}

  async listRepos(workspace: string): Promise<BitbucketRepo[]> {
    const res = await this.fetch(`/2.0/repositories/${workspace}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list repos`);
    }
    const data = await res.json();
    return (data.values ?? []).map((r: Record<string, unknown>) => this.normalizeRepo(r, workspace));
  }

  async browseFiles(workspace: string, repoSlug: string, path?: string, ref?: string): Promise<BitbucketFile[]> {
    const revision = ref ?? "HEAD";
    const filePath = path ? `/${path}` : "";
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/src/${revision}${filePath}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to browse files`);
    }
    const data = await res.json();
    return (data.values ?? []).map((f: Record<string, unknown>) => ({
      path: (f as { path: string }).path,
      type: (f as { type: string }).type === "commit_file" ? "file" as const : "directory" as const,
      size: (f as { size?: number }).size,
    }));
  }

  async readFile(workspace: string, repoSlug: string, filePath: string, ref?: string): Promise<string> {
    const revision = ref ?? "HEAD";
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/src/${revision}/${filePath}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to read file`);
    }
    return res.text();
  }

  async listBranches(workspace: string, repoSlug: string): Promise<BitbucketBranch[]> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/refs/branches`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list branches`);
    }
    const data = await res.json();
    return (data.values ?? []).map((b: Record<string, unknown>) => ({
      name: (b as { name: string }).name,
      latestCommit: ((b as { target?: { hash?: string } }).target?.hash) ?? "",
      isDefault: (b as { name: string }).name === ((data as { mainbranch?: { name?: string } }).mainbranch?.name ?? ""),
    }));
  }

  async createBranch(workspace: string, repoSlug: string, name: string, startPoint: string): Promise<BitbucketBranch> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/refs/branches`,
      {
        method: "POST",
        body: JSON.stringify({ name, target: { hash: startPoint } }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create branch`);
    }
    const b = await res.json();
    return {
      name: b.name ?? name,
      latestCommit: b.target?.hash ?? startPoint,
      isDefault: false,
    };
  }

  async deleteBranch(workspace: string, repoSlug: string, name: string): Promise<void> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/refs/branches/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete branch`);
    }
  }

  async listPullRequests(workspace: string, repoSlug: string, state?: string): Promise<BitbucketPullRequest[]> {
    const params = state ? `?state=${encodeURIComponent(state)}` : "";
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests${params}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list pull requests`);
    }
    const data = await res.json();
    return (data.values ?? []).map((pr: Record<string, unknown>) => this.normalizePullRequest(pr));
  }

  async getPullRequest(workspace: string, repoSlug: string, prId: number): Promise<BitbucketPullRequest> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get pull request ${prId}`);
    }
    const data = await res.json();
    return this.normalizePullRequest(data);
  }

  async createPullRequest(
    workspace: string,
    repoSlug: string,
    title: string,
    sourceBranch: string,
    targetBranch: string,
    description?: string,
  ): Promise<BitbucketPullRequest> {
    const body = {
      title,
      description: description ?? "",
      source: { branch: { name: sourceBranch } },
      destination: { branch: { name: targetBranch } },
    };
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests`,
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
    workspace: string,
    repoSlug: string,
    prId: number,
    fields: { title?: string; description?: string },
  ): Promise<BitbucketPullRequest> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
      {
        method: "PUT",
        body: JSON.stringify(fields),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to update pull request ${prId}`);
    }
    const data = await res.json();
    return this.normalizePullRequest(data);
  }

  async mergePullRequest(workspace: string, repoSlug: string, prId: number): Promise<void> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`,
      { method: "POST" },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to merge pull request ${prId}`);
    }
  }

  async declinePullRequest(workspace: string, repoSlug: string, prId: number): Promise<void> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/decline`,
      { method: "POST" },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to decline pull request ${prId}`);
    }
  }

  async listPrComments(workspace: string, repoSlug: string, prId: number): Promise<BitbucketPrComment[]> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list PR comments`);
    }
    const data = await res.json();
    return (data.values ?? []).map((c: Record<string, unknown>) => this.normalizeComment(c));
  }

  async addPrComment(workspace: string, repoSlug: string, prId: number, text: string): Promise<BitbucketPrComment> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: { raw: text } }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add PR comment`);
    }
    const data = await res.json();
    return this.normalizeComment(data);
  }

  async listCommits(workspace: string, repoSlug: string, ref?: string, maxResults?: number): Promise<BitbucketCommit[]> {
    const params: string[] = [];
    if (maxResults) params.push(`pagelen=${maxResults}`);
    const query = params.length > 0 ? `?${params.join("&")}` : "";
    const path = ref
      ? `/2.0/repositories/${workspace}/${repoSlug}/commits/${encodeURIComponent(ref)}${query}`
      : `/2.0/repositories/${workspace}/${repoSlug}/commits${query}`;
    const res = await this.fetch(path);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list commits`);
    }
    const data = await res.json();
    return (data.values ?? []).map((c: Record<string, unknown>) => this.normalizeCommit(c));
  }

  async getCommit(workspace: string, repoSlug: string, commitId: string): Promise<BitbucketCommit> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/commit/${commitId}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get commit ${commitId}`);
    }
    const data = await res.json();
    return this.normalizeCommit(data);
  }

  async getDiff(workspace: string, repoSlug: string, commitId: string): Promise<string> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/diff/${commitId}`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get diff`);
    }
    return res.text();
  }

  async searchCode(workspace: string, repoSlug: string, query: string): Promise<{ file: string; matches: string[] }[]> {
    const params = `?search_query=${encodeURIComponent(query)}&workspace=${encodeURIComponent(workspace)}`;
    const res = await this.fetch(`/2.0/search/code${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search code`);
    }
    const data = await res.json();
    return (data.values ?? []).map((r: Record<string, unknown>) => ({
      file: ((r as { file?: { path?: string } }).file?.path) ?? "",
      matches: ((r as { content_matches?: Array<{ lines?: Array<{ line?: string }> }> }).content_matches ?? []).map(
        (m: { lines?: Array<{ line?: string }> }) =>
          (m.lines ?? []).map((l: { line?: string }) => l.line ?? "").join("\n"),
      ),
    }));
  }

  async listWebhooks(workspace: string, repoSlug: string): Promise<BitbucketWebhook[]> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/hooks`,
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list webhooks`);
    }
    const data = await res.json();
    return (data.values ?? []).map((w: Record<string, unknown>) => this.normalizeWebhook(w));
  }

  async createWebhook(
    workspace: string,
    repoSlug: string,
    name: string,
    url: string,
    events: string[],
  ): Promise<BitbucketWebhook> {
    const res = await this.fetch(
      `/2.0/repositories/${workspace}/${repoSlug}/hooks`,
      {
        method: "POST",
        body: JSON.stringify({ description: name, url, events, active: true }),
      },
    );
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create webhook`);
    }
    const data = await res.json();
    return this.normalizeWebhook(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeRepo(raw: any, workspace: string): BitbucketRepo {
    return {
      slug: raw.slug,
      name: raw.name,
      projectKey: workspace,
      description: raw.description ?? "",
      defaultBranch: raw.mainbranch?.name ?? null,
      isPublic: raw.is_private === false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizePullRequest(raw: any): BitbucketPullRequest {
    return {
      id: raw.id,
      title: raw.title ?? "",
      description: raw.description ?? "",
      state: raw.state ?? "",
      author: raw.author?.display_name ?? raw.author?.nickname ?? "",
      sourceBranch: raw.source?.branch?.name ?? "",
      targetBranch: raw.destination?.branch?.name ?? "",
      created: raw.created_on ?? "",
      updated: raw.updated_on ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeComment(raw: any): BitbucketPrComment {
    return {
      id: raw.id,
      text: raw.content?.raw ?? "",
      author: raw.user?.display_name ?? raw.user?.nickname ?? "",
      created: raw.created_on ?? "",
      updated: raw.updated_on ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeCommit(raw: any): BitbucketCommit {
    return {
      id: raw.hash,
      message: raw.message ?? "",
      author: raw.author?.user?.display_name ?? raw.author?.raw ?? "",
      authorTimestamp: raw.date ?? "",
      parents: (raw.parents ?? []).map((p: { hash: string }) => p.hash),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeWebhook(raw: any): BitbucketWebhook {
    return {
      id: raw.uuid ? parseInt(raw.uuid.replace(/[{}]/g, "").split("-")[0], 16) : raw.id ?? 0,
      name: raw.description ?? "",
      url: raw.url ?? "",
      events: raw.events ?? [],
      active: raw.active ?? true,
    };
  }
}
