import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxbridgeConfig } from "@foxbridge/config";
import {
  createAtlassianFetch,
  InsightAssetsClient,
  type UserCredentials,
} from "@foxbridge/atlassian";
import type { PiiScrubber } from "@foxbridge/scrubber";
import { shouldRegisterTool } from "../middleware/feature-toggle.js";
import { scrubToolResult } from "../middleware/scrub.js";

function fmt(data: unknown, scrubber: PiiScrubber | null): string {
  const text = JSON.stringify(data, null, 2);
  return scrubToolResult(text, scrubber);
}

function textResult(data: unknown, scrubber: PiiScrubber | null) {
  return { content: [{ type: "text" as const, text: fmt(data, scrubber) }] };
}

export function registerAssetsTools(
  server: McpServer,
  config: FoxbridgeConfig,
  credentials: UserCredentials,
  scrubber: PiiScrubber | null,
): void {
  const jiraUrl = config.atlassian.jira_url ?? config.atlassian.base_url;
  const fetch = createAtlassianFetch(jiraUrl, config.atlassian.platform, credentials, config.atlassian.auth_method);
  const client = new InsightAssetsClient(fetch);
  const features = config.features;

  // ── Read tools ──────────────────────────────────────────────────────

  if (shouldRegisterTool("assets", "read", features)) {
    server.tool(
      "assets_search",
      "Search Jira Assets / Insight objects using AQL (Assets Query Language)",
      {
        query: z.string().describe("AQL query string (e.g. 'objectType = Server')"),
        schemaId: z.number().optional().describe("Limit search to a specific schema ID"),
        page: z.number().optional().describe("Page number (default 1)"),
        resultsPerPage: z.number().optional().describe("Results per page (default 25)"),
      },
      async (args) => {
        const result = await client.searchAql(args.query, {
          schemaId: args.schemaId,
          page: args.page,
          resultsPerPage: args.resultsPerPage,
        });
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "assets_get_object",
      "Get a single Jira Assets / Insight object by ID",
      {
        objectId: z.number().describe("Object ID"),
      },
      async (args) => {
        const result = await client.getObject(args.objectId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "assets_get_object_history",
      "Get the change history of a Jira Assets / Insight object",
      {
        objectId: z.number().describe("Object ID"),
      },
      async (args) => {
        const result = await client.getObjectHistory(args.objectId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "assets_get_connected_tickets",
      "Get Jira issues linked to a Jira Assets / Insight object",
      {
        objectId: z.number().describe("Object ID"),
      },
      async (args) => {
        const result = await client.getObjectConnectedTickets(args.objectId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "assets_list_schemas",
      "List all Jira Assets / Insight object schemas",
      {},
      async () => {
        const result = await client.listSchemas();
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "assets_list_object_types",
      "List object types in a Jira Assets / Insight schema",
      {
        schemaId: z.number().describe("Schema ID"),
      },
      async (args) => {
        const result = await client.listObjectTypes(args.schemaId);
        return textResult(result, scrubber);
      },
    );
  }
}
