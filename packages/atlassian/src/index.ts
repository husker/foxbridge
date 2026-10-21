export { createAtlassianFetch, type FetchOptions } from "./http-client.js";
export { isCloudUrl } from "./platform.js";
export { adfToText, textToAdf } from "./adf.js";
export type { UserCredentials, AtlassianFetch, PagedResult } from "./types.js";

// Jira
export { createJiraClient } from "./jira/client.js";
export type {
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
} from "./jira/types.js";

// Confluence
export { createConfluenceClient } from "./confluence/client.js";
export type {
  ConfluenceClient,
  ConfluencePage,
  ConfluenceSpace,
  ConfluenceSearchResult,
  ConfluenceComment,
  ConfluenceLabel,
  ConfluenceAttachment,
  ConfluenceContentProperty,
} from "./confluence/types.js";

// Bitbucket
export { createBitbucketClient } from "./bitbucket/client.js";
export type {
  BitbucketClient,
  BitbucketRepo,
  BitbucketFile,
  BitbucketBranch,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPrComment,
  BitbucketWebhook,
} from "./bitbucket/types.js";

// Assets (Insight — DC only)
export { InsightAssetsClient } from "./assets/client.js";
export type {
  AssetsClient,
  AssetObject,
  AssetSchema,
  AssetObjectType,
  AssetHistoryEntry,
  AqlSearchResponse,
} from "./assets/types.js";
