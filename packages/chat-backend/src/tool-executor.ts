import type { FoxbridgeConfig } from "@foxbridge/config";
import type { UserCredentials } from "@foxbridge/atlassian";
import {
  createAtlassianFetch,
  createJiraClient,
  createConfluenceClient,
  createBitbucketClient,
  InsightAssetsClient,
  type FetchOptions,
} from "@foxbridge/atlassian";
import type {
  JiraClient,
  ConfluenceClient,
  BitbucketClient,
  AssetsClient,
} from "@foxbridge/atlassian";
import { PiiScrubber } from "@foxbridge/scrubber";

export interface ToolExecutorClients {
  jira: JiraClient | null;
  confluence: ConfluenceClient | null;
  bitbucket: BitbucketClient | null;
  assets: AssetsClient | null;
}

export interface ToolExecutor {
  clients: ToolExecutorClients;
  scrubber: PiiScrubber | null;
}

export function createToolExecutor(
  config: FoxbridgeConfig,
  credentials: UserCredentials,
  fetchOptions?: FetchOptions,
): ToolExecutor {
  const { platform, auth_method, base_url, jira_url, confluence_url, bitbucket_url } = config.atlassian;
  const scrubber = config.scrub_pii ? new PiiScrubber() : null;

  const makeFetch = (url: string) =>
    createAtlassianFetch(url, platform, credentials, auth_method, fetchOptions);

  const clients: ToolExecutorClients = {
    jira:
      config.features.jira.read || config.features.jira.write
        ? createJiraClient(makeFetch(jira_url ?? base_url), platform)
        : null,
    confluence:
      config.features.confluence.read || config.features.confluence.write
        ? createConfluenceClient(makeFetch(confluence_url ?? base_url), platform)
        : null,
    bitbucket:
      config.features.bitbucket.read || config.features.bitbucket.write
        ? createBitbucketClient(makeFetch(bitbucket_url ?? base_url), platform)
        : null,
    assets:
      (config.features as any).assets?.read
        ? new InsightAssetsClient(makeFetch(jira_url ?? base_url))
        : null,
  };

  return { clients, scrubber };
}
