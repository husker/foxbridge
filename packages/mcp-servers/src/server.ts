import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxbridgeConfig } from "@foxbridge/config";
import type { UserCredentials } from "@foxbridge/atlassian";
import { PiiScrubber } from "@foxbridge/scrubber";
import { registerJiraTools } from "./tools/jira.js";
import { registerConfluenceTools } from "./tools/confluence.js";
import { registerBitbucketTools } from "./tools/bitbucket.js";
import { registerAssetsTools } from "./tools/assets.js";

export function createFoxbridgeServer(
  config: FoxbridgeConfig,
  credentials: UserCredentials,
): McpServer {
  const server = new McpServer({
    name: "foxbridge",
    version: "0.1.0",
  });
  const scrubber = config.scrub_pii ? new PiiScrubber() : null;

  registerJiraTools(server, config, credentials, scrubber);
  registerConfluenceTools(server, config, credentials, scrubber);
  registerBitbucketTools(server, config, credentials, scrubber);
  registerAssetsTools(server, config, credentials, scrubber);

  return server;
}
