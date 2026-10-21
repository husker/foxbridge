import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxbridgeConfig } from "@foxbridge/config";
import {
  createAtlassianFetch,
  createConfluenceClient,
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

export function registerConfluenceTools(
  server: McpServer,
  config: FoxbridgeConfig,
  credentials: UserCredentials,
  scrubber: PiiScrubber | null,
): void {
  const confUrl = config.atlassian.confluence_url ?? config.atlassian.base_url;
  const fetch = createAtlassianFetch(confUrl, config.atlassian.platform, credentials, config.atlassian.auth_method);
  const client = createConfluenceClient(fetch, config.atlassian.platform);
  const features = config.features;

  // ── Read tools ──────────────────────────────────────────────────────

  if (shouldRegisterTool("confluence", "read", features)) {
    server.tool(
      "confluence_search",
      "Search Confluence using CQL",
      {
        cql: z.string().describe("CQL query string"),
        maxResults: z.number().optional().describe("Maximum number of results"),
      },
      async (args) => {
        const result = await client.search(args.cql, args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_read_page",
      "Read a Confluence page by ID",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        const result = await client.getPage(args.pageId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_list_spaces",
      "List Confluence spaces",
      {
        maxResults: z.number().optional().describe("Maximum number of results"),
      },
      async (args) => {
        const result = await client.listSpaces(args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_list_labels",
      "List labels on a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        const result = await client.listLabels(args.pageId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_list_attachments",
      "List attachments on a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        const result = await client.listAttachments(args.pageId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_download_attachment",
      "Download a Confluence attachment by URL",
      {
        downloadUrl: z.string().describe("Download URL from list_attachments"),
      },
      async (args) => {
        const result = await client.downloadAttachment(args.downloadUrl);
        return {
          content: [{ type: "text" as const, text: fmt({ filename: result.filename, size: result.content.length }, scrubber) }],
        };
      },
    );

    server.tool(
      "confluence_list_comments",
      "List comments on a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        const result = await client.listComments(args.pageId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_get_content_property",
      "Get a content property from a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        key: z.string().describe("Property key"),
      },
      async (args) => {
        const result = await client.getContentProperty(args.pageId, args.key);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_list_inline_comments",
      "List inline comments on a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        const result = await client.getInlineComments(args.pageId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_get_page_children",
      "Get child pages of a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        maxResults: z.number().optional().describe("Maximum number of results"),
      },
      async (args) => {
        const result = await client.getPageDescendants(args.pageId, args.maxResults);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_list_space_pages",
      "List pages in a Confluence space",
      {
        spaceKey: z.string().describe("Space key"),
        maxResults: z.number().optional().describe("Maximum number of results"),
        title: z.string().optional().describe("Filter by page title"),
      },
      async (args) => {
        const result = await client.getSpacePages(args.spaceKey, args.maxResults, args.title);
        return textResult(result, scrubber);
      },
    );
  }

  // ── Write tools ─────────────────────────────────────────────────────

  if (shouldRegisterTool("confluence", "write", features)) {
    server.tool(
      "confluence_create_page",
      "Create a new Confluence page",
      {
        spaceKey: z.string().describe("Space key"),
        title: z.string().describe("Page title"),
        body: z.string().describe("Page body (storage format HTML)"),
        parentId: z.string().optional().describe("Parent page ID"),
      },
      async (args) => {
        const result = await client.createPage(args.spaceKey, args.title, args.body, args.parentId);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_update_page",
      "Update an existing Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        title: z.string().describe("Page title"),
        body: z.string().describe("Page body (storage format HTML)"),
        version: z.number().describe("Current version number (for optimistic locking)"),
      },
      async (args) => {
        const result = await client.updatePage(args.pageId, args.title, args.body, args.version);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_delete_page",
      "Delete a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
      },
      async (args) => {
        await client.deletePage(args.pageId);
        return textResult({ success: true, deleted: args.pageId }, scrubber);
      },
    );

    server.tool(
      "confluence_add_label",
      "Add a label to a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        label: z.string().describe("Label name"),
      },
      async (args) => {
        await client.addLabel(args.pageId, args.label);
        return textResult({ success: true, pageId: args.pageId, label: args.label }, scrubber);
      },
    );

    server.tool(
      "confluence_remove_label",
      "Remove a label from a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        label: z.string().describe("Label name"),
      },
      async (args) => {
        await client.removeLabel(args.pageId, args.label);
        return textResult({ success: true, pageId: args.pageId, label: args.label }, scrubber);
      },
    );

    server.tool(
      "confluence_add_attachment",
      "Add an attachment to a Confluence page (base64 encoded content)",
      {
        pageId: z.string().describe("Page ID"),
        filename: z.string().describe("File name"),
        contentBase64: z.string().describe("Base64-encoded file content"),
      },
      async (args) => {
        const content = Buffer.from(args.contentBase64, "base64");
        const result = await client.addAttachment(args.pageId, args.filename, content);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_add_comment",
      "Add a comment to a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        body: z.string().describe("Comment body"),
      },
      async (args) => {
        const result = await client.addComment(args.pageId, args.body);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_add_inline_comment",
      "Add an inline comment to a Confluence page anchored to specific text",
      {
        pageId: z.string().describe("Page ID"),
        body: z.string().describe("Comment body (storage format HTML)"),
        selectionText: z.string().describe("The text in the page to anchor the comment to"),
      },
      async (args) => {
        const result = await client.addInlineComment(args.pageId, args.body, args.selectionText);
        return textResult(result, scrubber);
      },
    );

    server.tool(
      "confluence_set_content_property",
      "Set a content property on a Confluence page",
      {
        pageId: z.string().describe("Page ID"),
        key: z.string().describe("Property key"),
        value: z.unknown().describe("Property value (JSON)"),
      },
      async (args) => {
        await client.setContentProperty(args.pageId, args.key, args.value);
        return textResult({ success: true, pageId: args.pageId, key: args.key }, scrubber);
      },
    );
  }
}
