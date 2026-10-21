export interface BitbucketRepo {
  slug: string;
  name: string;
  projectKey: string;
  description: string;
  defaultBranch: string | null;
  isPublic: boolean;
}

export interface BitbucketFile {
  path: string;
  type: "file" | "directory";
  size?: number;
}

export interface BitbucketBranch {
  name: string;
  latestCommit: string;
  isDefault: boolean;
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description: string;
  state: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  created: string;
  updated: string;
}

export interface BitbucketCommit {
  id: string;
  message: string;
  author: string;
  authorTimestamp: string;
  parents: string[];
}

export interface BitbucketPrComment {
  id: number;
  text: string;
  author: string;
  created: string;
  updated: string;
}

export interface BitbucketWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
}

export interface BitbucketClient {
  // Repositories
  listRepos(projectKey: string): Promise<BitbucketRepo[]>;

  // File browsing
  browseFiles(projectKey: string, repoSlug: string, path?: string, ref?: string): Promise<BitbucketFile[]>;
  readFile(projectKey: string, repoSlug: string, filePath: string, ref?: string): Promise<string>;

  // Branches
  listBranches(projectKey: string, repoSlug: string): Promise<BitbucketBranch[]>;
  createBranch(projectKey: string, repoSlug: string, name: string, startPoint: string): Promise<BitbucketBranch>;
  deleteBranch(projectKey: string, repoSlug: string, name: string): Promise<void>;

  // Pull Requests
  listPullRequests(projectKey: string, repoSlug: string, state?: string): Promise<BitbucketPullRequest[]>;
  getPullRequest(projectKey: string, repoSlug: string, prId: number): Promise<BitbucketPullRequest>;
  createPullRequest(projectKey: string, repoSlug: string, title: string, sourceBranch: string, targetBranch: string, description?: string): Promise<BitbucketPullRequest>;
  updatePullRequest(projectKey: string, repoSlug: string, prId: number, fields: { title?: string; description?: string }): Promise<BitbucketPullRequest>;
  mergePullRequest(projectKey: string, repoSlug: string, prId: number): Promise<void>;
  declinePullRequest(projectKey: string, repoSlug: string, prId: number): Promise<void>;

  // PR Comments
  listPrComments(projectKey: string, repoSlug: string, prId: number): Promise<BitbucketPrComment[]>;
  addPrComment(projectKey: string, repoSlug: string, prId: number, text: string): Promise<BitbucketPrComment>;

  // Commits
  listCommits(projectKey: string, repoSlug: string, ref?: string, maxResults?: number): Promise<BitbucketCommit[]>;
  getCommit(projectKey: string, repoSlug: string, commitId: string): Promise<BitbucketCommit>;
  getDiff(projectKey: string, repoSlug: string, commitId: string): Promise<string>;

  // Code Search
  searchCode(projectKey: string, repoSlug: string, query: string): Promise<{ file: string; matches: string[] }[]>;

  // Webhooks (admin)
  listWebhooks(projectKey: string, repoSlug: string): Promise<BitbucketWebhook[]>;
  createWebhook(projectKey: string, repoSlug: string, name: string, url: string, events: string[]): Promise<BitbucketWebhook>;
}
