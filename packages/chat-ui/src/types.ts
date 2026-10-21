export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LoginCredentials {
  user: string;
  token: string;
}

export interface FeatureConfig {
  jira: { read: boolean; write: boolean };
  confluence: { read: boolean; write: boolean };
  bitbucket: { read: boolean; write: boolean };
  atlassian_base_url?: string;
  atlassian_platform?: string;
  oauth_enabled?: boolean;
}

export interface JiraIssueDetail {
  key: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  issueType: string;
  created: string;
  updated: string;
  labels: string[];
  components: string[];
  project: string;
}

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
  updated: string;
}

export interface RecentItem {
  key: string;
  type: string; // "Bug", "Task", "Story", etc.
  summary: string;
}

export type Theme = "light" | "dark";
