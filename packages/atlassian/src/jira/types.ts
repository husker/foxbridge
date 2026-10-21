export interface JiraIssue {
  key: string;
  id: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  issueType: string;
  projectKey: string;
  created: string;
  updated: string;
  labels: string[];
  components: string[];
  fixVersions: string[];
  links: JiraIssueLink[];
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  // DC + Cloud Agile API use offset/total pagination.
  // Cloud's /search/jql endpoint is cursor-based and omits these.
  total?: number;
  maxResults?: number;
  startAt?: number;
  // Cloud /search/jql only.
  nextPageToken?: string;
  isLast?: boolean;
}

export interface JiraComment {
  id: string;
  body: string;
  author: string;
  created: string;
  updated: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  boardId: number;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  projectKey?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  created: string;
  author: string;
  contentUrl: string;
}

export interface JiraWorklog {
  id: string;
  issueId: string;
  author: string;
  timeSpentSeconds: number;
  comment: string | null;
  started: string;
  created: string;
  updated: string;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  schema?: {
    type: string;
    system?: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  categoryKey: string;
}

export interface JiraIssueLink {
  id: string;
  type: string;
  inwardIssue?: string;
  outwardIssue?: string;
}

export interface JiraRemoteLink {
  id: string;
  url: string;
  title: string;
  summary?: string;
}

export interface JiraFieldMeta {
  fieldId: string;
  name: string;
  required: boolean;
  schema: { type: string };
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraClient {
  // Issue CRUD
  searchIssues(jql: string, maxResults?: number): Promise<JiraSearchResult>;
  getIssue(issueKey: string): Promise<JiraIssue>;
  createIssue(projectKey: string, issueType: string, summary: string, description?: string, fields?: Record<string, unknown>): Promise<{ key: string; id: string }>;
  updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void>;
  deleteIssue(issueKey: string): Promise<void>;

  // Comments
  getComments(issueKey: string): Promise<JiraComment[]>;
  addComment(issueKey: string, body: string): Promise<JiraComment>;
  updateComment(issueKey: string, commentId: string, body: string): Promise<JiraComment>;
  deleteComment(issueKey: string, commentId: string): Promise<void>;

  // Transitions
  getTransitions(issueKey: string): Promise<JiraTransition[]>;
  transitionIssue(issueKey: string, transitionId: string): Promise<void>;

  // Assignments and Links
  assignIssue(issueKey: string, accountIdOrUsername: string | null): Promise<void>;
  linkIssues(inwardKey: string, outwardKey: string, linkType: string): Promise<void>;

  // Boards and Sprints (Agile)
  listBoards(projectKey?: string): Promise<JiraBoard[]>;
  getBoard(boardId: number): Promise<JiraBoard>;
  listSprints(boardId: number, state?: string): Promise<JiraSprint[]>;
  getSprintIssues(sprintId: number, maxResults?: number): Promise<JiraSearchResult>;

  // Projects
  listProjects(): Promise<JiraProject[]>;

  // Attachments
  listAttachments(issueKey: string): Promise<JiraAttachment[]>;
  downloadAttachment(attachmentId: string): Promise<{ filename: string; content: Buffer }>;
  addAttachment(issueKey: string, filename: string, content: Buffer): Promise<JiraAttachment>;

  // Worklogs
  listWorklogs(issueKey: string): Promise<JiraWorklog[]>;
  addWorklog(issueKey: string, timeSpentSeconds: number, comment?: string, started?: string): Promise<JiraWorklog>;

  // Metadata
  listFields(): Promise<JiraField[]>;
  listPriorities(): Promise<JiraPriority[]>;
  listStatuses(): Promise<JiraStatus[]>;

  // Remote Links
  getRemoteIssueLinks(issueKey: string): Promise<JiraRemoteLink[]>;

  // Issue Type Metadata
  getIssueTypeFields(projectKey: string, issueTypeId: string): Promise<JiraFieldMeta[]>;
  getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]>;

  // User Search
  findUsers(query: string): Promise<JiraUser[]>;
}
