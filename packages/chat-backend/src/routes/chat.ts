import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { FoxbridgeConfig } from "@foxbridge/config";
import type { JiraClient, ConfluenceClient, BitbucketClient, AssetsClient } from "@foxbridge/atlassian";
import type { PiiScrubber } from "@foxbridge/scrubber";
import { getToolDefinitions, toAnthropicTools, toOpenAITools } from "@foxbridge/mcp-servers";
import type { SessionStore } from "../session.js";
import { createToolExecutor } from "../tool-executor.js";
import type { ToolExecutorClients } from "../tool-executor.js";
import { classifyError } from "../errors.js";
import { createLogger } from "../logger.js";
import { parseFile, formatFilesForPrompt, type ParsedFile } from "../file-parser.js";

const COOKIE_NAME = "foxbridge_session";
const MAX_TOOL_ITERATIONS = 10;

function buildSystemPrompt(userIdentity: string): string {
  return (
    "You are Foxbridge, an AI assistant connected to this organization's Atlassian platform (Jira, Confluence, Bitbucket). " +
    "Use the available tools to answer questions and take actions. Always use tools to get real data — never make up issue keys, page titles, or other specifics.\n\n" +
    `The current user is: ${userIdentity}. When they say "my issues", "assigned to me", etc., use this identity to filter results.\n\n` +
    "Tone: Be direct, calm, and professional. No exclamation marks. No emojis. No filler phrases like 'Great question!' or 'Let me fetch that for you!' — just do it and present the results. " +
    "When presenting data, use clean markdown tables without emoji in cells. Keep responses concise — lead with the data, add a brief summary only if it adds value. " +
    "Do not narrate your tool calls — the user does not need to know you are 'searching' or 'fetching'. Just present the results when ready."
  );
}

// ── Tool routing ──────────────────────────────────────────────────────────

function scrubResult(text: string, scrubber: PiiScrubber | null): string {
  return scrubber ? scrubber.scrubText(text) : text;
}

async function routeJiraTool(
  name: string,
  input: Record<string, unknown>,
  client: JiraClient,
): Promise<string> {
  switch (name) {
    // Read
    case "jira_search_issues":
      return JSON.stringify(await client.searchIssues(input.jql as string, input.maxResults as number | undefined));
    case "jira_read_issue":
      return JSON.stringify(await client.getIssue(input.issueKey as string));
    case "jira_list_comments":
      return JSON.stringify(await client.getComments(input.issueKey as string));
    case "jira_list_transitions":
      return JSON.stringify(await client.getTransitions(input.issueKey as string));
    case "jira_list_boards":
      return JSON.stringify(await client.listBoards(input.projectKey as string | undefined));
    case "jira_list_sprints":
      return JSON.stringify(await client.listSprints(input.boardId as number, input.state as string | undefined));
    case "jira_get_sprint_issues":
      return JSON.stringify(await client.getSprintIssues(input.sprintId as number, input.maxResults as number | undefined));
    case "jira_list_projects":
      return JSON.stringify(await client.listProjects());
    case "jira_list_attachments":
      return JSON.stringify(await client.listAttachments(input.issueKey as string));
    case "jira_download_attachment": {
      const att = await client.downloadAttachment(input.attachmentId as string);
      return JSON.stringify({ filename: att.filename, size: att.content.length });
    }
    case "jira_list_worklogs":
      return JSON.stringify(await client.listWorklogs(input.issueKey as string));
    case "jira_list_fields":
      return JSON.stringify(await client.listFields());
    case "jira_list_priorities":
      return JSON.stringify(await client.listPriorities());
    case "jira_list_statuses":
      return JSON.stringify(await client.listStatuses());
    case "jira_get_remote_links":
      return JSON.stringify(await client.getRemoteIssueLinks(input.issueKey as string));
    case "jira_get_issue_type_fields":
      return JSON.stringify(await client.getIssueTypeFields(input.projectKey as string, input.issueTypeId as string));
    case "jira_get_project_issue_types":
      return JSON.stringify(await client.getProjectIssueTypes(input.projectKey as string));
    case "jira_find_users":
      return JSON.stringify(await client.findUsers(input.query as string));
    // Write
    case "jira_create_issue":
      return JSON.stringify(await client.createIssue(
        input.projectKey as string, input.issueType as string, input.summary as string,
        input.description as string | undefined, input.fields as Record<string, unknown> | undefined,
      ));
    case "jira_update_issue":
      await client.updateIssue(input.issueKey as string, input.fields as Record<string, unknown>);
      return JSON.stringify({ success: true, issueKey: input.issueKey });
    case "jira_delete_issue":
      await client.deleteIssue(input.issueKey as string);
      return JSON.stringify({ success: true, deleted: input.issueKey });
    case "jira_add_comment":
      return JSON.stringify(await client.addComment(input.issueKey as string, input.body as string));
    case "jira_update_comment":
      return JSON.stringify(await client.updateComment(input.issueKey as string, input.commentId as string, input.body as string));
    case "jira_delete_comment":
      await client.deleteComment(input.issueKey as string, input.commentId as string);
      return JSON.stringify({ success: true, deleted: input.commentId });
    case "jira_transition_issue":
      await client.transitionIssue(input.issueKey as string, input.transitionId as string);
      return JSON.stringify({ success: true, issueKey: input.issueKey });
    case "jira_assign_issue":
      await client.assignIssue(input.issueKey as string, input.accountIdOrUsername as string | null);
      return JSON.stringify({ success: true, issueKey: input.issueKey });
    case "jira_link_issues":
      await client.linkIssues(input.inwardKey as string, input.outwardKey as string, input.linkType as string);
      return JSON.stringify({ success: true });
    case "jira_add_attachment": {
      const content = Buffer.from(input.contentBase64 as string, "base64");
      return JSON.stringify(await client.addAttachment(input.issueKey as string, input.filename as string, content));
    }
    case "jira_add_worklog":
      return JSON.stringify(await client.addWorklog(
        input.issueKey as string, input.timeSpentSeconds as number,
        input.comment as string | undefined, input.started as string | undefined,
      ));
    default:
      throw new Error(`Unknown Jira tool: ${name}`);
  }
}

async function routeConfluenceTool(
  name: string,
  input: Record<string, unknown>,
  client: ConfluenceClient,
): Promise<string> {
  switch (name) {
    // Read
    case "confluence_search":
      return JSON.stringify(await client.search(input.cql as string, input.maxResults as number | undefined));
    case "confluence_read_page":
      return JSON.stringify(await client.getPage(input.pageId as string));
    case "confluence_list_spaces":
      return JSON.stringify(await client.listSpaces(input.maxResults as number | undefined));
    case "confluence_list_labels":
      return JSON.stringify(await client.listLabels(input.pageId as string));
    case "confluence_list_attachments":
      return JSON.stringify(await client.listAttachments(input.pageId as string));
    case "confluence_download_attachment": {
      const att = await client.downloadAttachment(input.downloadUrl as string);
      return JSON.stringify({ filename: att.filename, size: att.content.length });
    }
    case "confluence_list_comments":
      return JSON.stringify(await client.listComments(input.pageId as string));
    case "confluence_get_content_property":
      return JSON.stringify(await client.getContentProperty(input.pageId as string, input.key as string));
    case "confluence_list_inline_comments":
      return JSON.stringify(await client.getInlineComments(input.pageId as string));
    case "confluence_get_page_children":
      return JSON.stringify(await client.getPageDescendants(input.pageId as string, input.maxResults as number | undefined));
    case "confluence_list_space_pages":
      return JSON.stringify(await client.getSpacePages(input.spaceKey as string, input.maxResults as number | undefined, input.title as string | undefined));
    // Write
    case "confluence_create_page":
      return JSON.stringify(await client.createPage(
        input.spaceKey as string, input.title as string, input.body as string,
        input.parentId as string | undefined,
      ));
    case "confluence_update_page":
      return JSON.stringify(await client.updatePage(
        input.pageId as string, input.title as string, input.body as string, input.version as number,
      ));
    case "confluence_delete_page":
      await client.deletePage(input.pageId as string);
      return JSON.stringify({ success: true, deleted: input.pageId });
    case "confluence_add_label":
      await client.addLabel(input.pageId as string, input.label as string);
      return JSON.stringify({ success: true, pageId: input.pageId, label: input.label });
    case "confluence_remove_label":
      await client.removeLabel(input.pageId as string, input.label as string);
      return JSON.stringify({ success: true, pageId: input.pageId, label: input.label });
    case "confluence_add_attachment": {
      const content = Buffer.from(input.contentBase64 as string, "base64");
      return JSON.stringify(await client.addAttachment(input.pageId as string, input.filename as string, content));
    }
    case "confluence_add_comment":
      return JSON.stringify(await client.addComment(input.pageId as string, input.body as string));
    case "confluence_add_inline_comment":
      return JSON.stringify(await client.addInlineComment(input.pageId as string, input.body as string, input.selectionText as string));
    case "confluence_set_content_property":
      await client.setContentProperty(input.pageId as string, input.key as string, input.value);
      return JSON.stringify({ success: true, pageId: input.pageId, key: input.key });
    default:
      throw new Error(`Unknown Confluence tool: ${name}`);
  }
}

async function routeBitbucketTool(
  name: string,
  input: Record<string, unknown>,
  client: BitbucketClient,
): Promise<string> {
  switch (name) {
    // Read
    case "bitbucket_list_repos":
      return JSON.stringify(await client.listRepos(input.projectKey as string));
    case "bitbucket_browse_files":
      return JSON.stringify(await client.browseFiles(
        input.projectKey as string, input.repoSlug as string,
        input.path as string | undefined, input.ref as string | undefined,
      ));
    case "bitbucket_read_file":
      return JSON.stringify(await client.readFile(
        input.projectKey as string, input.repoSlug as string,
        input.filePath as string, input.ref as string | undefined,
      ));
    case "bitbucket_search_code":
      return JSON.stringify(await client.searchCode(
        input.projectKey as string, input.repoSlug as string, input.query as string,
      ));
    case "bitbucket_list_branches":
      return JSON.stringify(await client.listBranches(input.projectKey as string, input.repoSlug as string));
    case "bitbucket_list_pull_requests":
      return JSON.stringify(await client.listPullRequests(
        input.projectKey as string, input.repoSlug as string, input.state as string | undefined,
      ));
    case "bitbucket_read_pull_request":
      return JSON.stringify(await client.getPullRequest(
        input.projectKey as string, input.repoSlug as string, input.prId as number,
      ));
    case "bitbucket_list_pr_comments":
      return JSON.stringify(await client.listPrComments(
        input.projectKey as string, input.repoSlug as string, input.prId as number,
      ));
    case "bitbucket_list_commits":
      return JSON.stringify(await client.listCommits(
        input.projectKey as string, input.repoSlug as string,
        input.ref as string | undefined, input.maxResults as number | undefined,
      ));
    case "bitbucket_get_commit":
      return JSON.stringify(await client.getCommit(
        input.projectKey as string, input.repoSlug as string, input.commitId as string,
      ));
    case "bitbucket_get_diff":
      return JSON.stringify(await client.getDiff(
        input.projectKey as string, input.repoSlug as string, input.commitId as string,
      ));
    case "bitbucket_list_webhooks":
      return JSON.stringify(await client.listWebhooks(input.projectKey as string, input.repoSlug as string));
    // Write
    case "bitbucket_create_branch":
      return JSON.stringify(await client.createBranch(
        input.projectKey as string, input.repoSlug as string,
        input.name as string, input.startPoint as string,
      ));
    case "bitbucket_delete_branch":
      await client.deleteBranch(input.projectKey as string, input.repoSlug as string, input.name as string);
      return JSON.stringify({ success: true, deleted: input.name });
    case "bitbucket_create_pull_request":
      return JSON.stringify(await client.createPullRequest(
        input.projectKey as string, input.repoSlug as string,
        input.title as string, input.sourceBranch as string,
        input.targetBranch as string, input.description as string | undefined,
      ));
    case "bitbucket_update_pull_request":
      return JSON.stringify(await client.updatePullRequest(
        input.projectKey as string, input.repoSlug as string, input.prId as number,
        { title: input.title as string | undefined, description: input.description as string | undefined },
      ));
    case "bitbucket_merge_pull_request":
      await client.mergePullRequest(input.projectKey as string, input.repoSlug as string, input.prId as number);
      return JSON.stringify({ success: true, merged: input.prId });
    case "bitbucket_decline_pull_request":
      await client.declinePullRequest(input.projectKey as string, input.repoSlug as string, input.prId as number);
      return JSON.stringify({ success: true, declined: input.prId });
    case "bitbucket_add_pr_comment":
      return JSON.stringify(await client.addPrComment(
        input.projectKey as string, input.repoSlug as string,
        input.prId as number, input.text as string,
      ));
    case "bitbucket_create_webhook":
      return JSON.stringify(await client.createWebhook(
        input.projectKey as string, input.repoSlug as string,
        input.name as string, input.url as string, input.events as string[],
      ));
    default:
      throw new Error(`Unknown Bitbucket tool: ${name}`);
  }
}

async function routeAssetsTool(
  name: string,
  input: Record<string, unknown>,
  client: AssetsClient,
): Promise<string> {
  switch (name) {
    case "assets_search":
      return JSON.stringify(await client.searchAql(input.query as string, {
        schemaId: input.schemaId as number | undefined,
        page: input.page as number | undefined,
        resultsPerPage: input.resultsPerPage as number | undefined,
      }));
    case "assets_get_object":
      return JSON.stringify(await client.getObject(input.objectId as number));
    case "assets_get_object_history":
      return JSON.stringify(await client.getObjectHistory(input.objectId as number));
    case "assets_get_connected_tickets":
      return JSON.stringify(await client.getObjectConnectedTickets(input.objectId as number));
    case "assets_list_schemas":
      return JSON.stringify(await client.listSchemas());
    case "assets_list_object_types":
      return JSON.stringify(await client.listObjectTypes(input.schemaId as number));
    default:
      throw new Error(`Unknown Assets tool: ${name}`);
  }
}

async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  clients: ToolExecutorClients,
  scrubber: PiiScrubber | null,
  session?: import("../session.js").Session,
): Promise<string> {
  let result: string;

  if (toolName === "attach_uploaded_file") {
    const filename = input.filename as string;
    const targetType = input.target_type as string;
    const targetKey = input.target_key as string;

    if (!session) throw new Error("No session available");
    const file = session.uploadedFiles.get(filename);
    if (!file) throw new Error(`File not found in session: ${filename}. Available files: ${[...session.uploadedFiles.keys()].join(", ")}`);

    if (targetType === "jira_issue") {
      if (!clients.jira) throw new Error("Jira tools are not enabled");
      const attachment = await clients.jira.addAttachment(targetKey, file.filename, file.buffer);
      result = JSON.stringify(attachment);
    } else if (targetType === "confluence_page") {
      if (!clients.confluence) throw new Error("Confluence tools are not enabled");
      const attachment = await clients.confluence.addAttachment(targetKey, file.filename, file.buffer);
      result = JSON.stringify(attachment);
    } else {
      throw new Error(`Invalid target_type: ${targetType}. Must be "jira_issue" or "confluence_page".`);
    }
  } else if (toolName.startsWith("jira_")) {
    if (!clients.jira) throw new Error("Jira tools are not enabled");
    result = await routeJiraTool(toolName, input, clients.jira);
  } else if (toolName.startsWith("confluence_")) {
    if (!clients.confluence) throw new Error("Confluence tools are not enabled");
    result = await routeConfluenceTool(toolName, input, clients.confluence);
  } else if (toolName.startsWith("bitbucket_")) {
    if (!clients.bitbucket) throw new Error("Bitbucket tools are not enabled");
    result = await routeBitbucketTool(toolName, input, clients.bitbucket);
  } else if (toolName.startsWith("assets_")) {
    if (!clients.assets) throw new Error("Assets tools are not enabled");
    result = await routeAssetsTool(toolName, input, clients.assets);
  } else {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return scrubResult(result, scrubber);
}

// ── Anthropic streaming ───────────────────────────────────────────────────

async function handleAnthropicChat(
  config: FoxbridgeConfig,
  toolDefs: ReturnType<typeof getToolDefinitions>,
  messages: Array<{ role: "user" | "assistant"; content: string | Anthropic.ContentBlockParam[] }>,
  clients: ToolExecutorClients,
  scrubber: PiiScrubber | null,
  res: import("express").Response,
  abortedRef: { value: boolean },
  log: ReturnType<typeof createLogger>,
  systemPrompt: string,
  session?: import("../session.js").Session,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.ai.api_key });
  const anthropicTools = toAnthropicTools(toolDefs);
  let assistantResponse = "";
  let toolIterations = 0;

  // Build messages compatible with Anthropic format
  let msgHistory: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  while (true) {
    if (abortedRef.value) break;

    const createParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: config.ai.model ?? "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: msgHistory,
    };

    // Only pass tools if we have any
    if (anthropicTools.length > 0) {
      (createParams as any).tools = anthropicTools;
    }

    const aiStart = Date.now();
    const response = await client.messages.create(createParams);
    log("info", "AI response received", { duration_ms: Date.now() - aiStart, stop_reason: response.stop_reason });

    // Extract text blocks, write to response
    for (const block of response.content) {
      if (block.type === "text") {
        // Add paragraph break between tool iterations so markdown renders correctly
        if (assistantResponse.length > 0 && !assistantResponse.endsWith("\n\n")) {
          assistantResponse += "\n\n";
          if (!abortedRef.value) res.write("\n\n");
        }
        assistantResponse += block.text;
        if (!abortedRef.value) res.write(block.text);
      }
    }

    if (response.stop_reason !== "tool_use") break;

    if (++toolIterations > MAX_TOOL_ITERATIONS) {
      const msg = "\n\nI've reached the maximum number of tool calls for this request.";
      assistantResponse += msg;
      if (!abortedRef.value) res.write(msg);
      break;
    }

    // Execute tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      // Send tool activity marker to frontend
      if (!abortedRef.value) {
        res.write(`\n[tool:${toolUse.name.replace(/_/g, " ")}...]\n`);
      }
      const toolStart = Date.now();
      log("info", `Tool call: ${toolUse.name}`, { toolName: toolUse.name });
      try {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          clients,
          scrubber,
          session,
        );
        log("info", `Tool done: ${toolUse.name}`, { toolName: toolUse.name, duration_ms: Date.now() - toolStart });
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      } catch (toolErr: any) {
        // Re-throw Atlassian 401s so the outer handler can invalidate session
        if (toolErr.message?.includes("failed: 401")) throw toolErr;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: ${toolErr.message}`,
          is_error: true,
        });
      }
    }

    msgHistory = [
      ...msgHistory,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ];
  }

  return assistantResponse;
}

// ── OpenAI streaming ──────────────────────────────────────────────────────

async function handleOpenAIChat(
  config: FoxbridgeConfig,
  toolDefs: ReturnType<typeof getToolDefinitions>,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  clients: ToolExecutorClients,
  scrubber: PiiScrubber | null,
  res: import("express").Response,
  abortedRef: { value: boolean },
  log: ReturnType<typeof createLogger>,
  systemPrompt: string,
  session?: import("../session.js").Session,
): Promise<string> {
  const isOllama = config.ai.provider === "ollama";
  const client = new OpenAI({
    apiKey: isOllama ? "ollama" : config.ai.api_key,
    baseURL: config.ai.base_url ?? (isOllama ? "http://host.docker.internal:11434/v1" : undefined),
  });

  const openaiTools = toOpenAITools(toolDefs);
  let assistantResponse = "";
  let toolIterations = 0;

  const defaultModel =
    config.ai.provider === "ollama"
      ? "llama3.1"
      : config.ai.provider === "azure_openai"
        ? "gpt-4o"
        : "gpt-4o";

  type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
  let msgHistory: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m): ChatMessage => ({ role: m.role, content: m.content })),
  ];

  while (true) {
    if (abortedRef.value) break;

    const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: config.ai.model ?? defaultModel,
      messages: msgHistory,
    };

    // Only pass tools if we have any
    if (openaiTools.length > 0) {
      createParams.tools = openaiTools as OpenAI.Chat.ChatCompletionTool[];
    }

    const response = await client.chat.completions.create(createParams);

    const choice = response.choices[0];
    if (!choice) break;

    const responseMsg = choice.message;

    // Write text content
    if (responseMsg.content) {
      if (assistantResponse.length > 0 && !assistantResponse.endsWith("\n\n")) {
        assistantResponse += "\n\n";
        if (!abortedRef.value) res.write("\n\n");
      }
      assistantResponse += responseMsg.content;
      if (!abortedRef.value) res.write(responseMsg.content);
    }

    if (choice.finish_reason !== "tool_calls" || !responseMsg.tool_calls?.length) break;

    if (++toolIterations > MAX_TOOL_ITERATIONS) {
      const msg = "\n\nI've reached the maximum number of tool calls for this request.";
      assistantResponse += msg;
      if (!abortedRef.value) res.write(msg);
      break;
    }

    // Build tool results
    const toolResultMessages: ChatMessage[] = [];
    for (const toolCall of responseMsg.tool_calls) {
      if (toolCall.type !== "function") continue;
      // Send tool activity marker to frontend
      if (!abortedRef.value) {
        res.write(`\n[tool:${toolCall.function.name.replace(/_/g, " ")}...]\n`);
      }
      const fn = toolCall.function;
      const toolStart = Date.now();
      log("info", `Tool call: ${fn.name}`, { toolName: fn.name });
      let toolContent: string;
      try {
        const input = JSON.parse(fn.arguments) as Record<string, unknown>;
        toolContent = await executeToolCall(fn.name, input, clients, scrubber, session);
      } catch (toolErr: any) {
        if (toolErr.message?.includes("failed: 401")) throw toolErr;
        toolContent = `Error: ${toolErr.message}`;
      }
      log("info", `Tool done: ${fn.name}`, { toolName: fn.name, duration_ms: Date.now() - toolStart });
      toolResultMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolContent,
      });
    }

    msgHistory = [
      ...msgHistory,
      responseMsg as ChatMessage,
      ...toolResultMessages,
    ];
  }

  return assistantResponse;
}

// ── Router ────────────────────────────────────────────────────────────────

export function createChatRouter(
  config: FoxbridgeConfig,
  sessionStore: SessionStore,
  upload?: { array(fieldName: string, maxCount: number): any },
): Router {
  const router = Router();
  const log = createLogger(config);
  const toolDefs = getToolDefinitions(config);

  // Chat-specific tool: attach an uploaded file to Jira/Confluence
  const attachToolDef = {
    name: "attach_uploaded_file",
    description: "Attach a file that was uploaded in this chat session to a Jira issue or Confluence page. Use the exact filename from the session file list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filename: { type: "string", description: "Exact filename of the uploaded file" },
        target_type: { type: "string", enum: ["jira_issue", "confluence_page"], description: "Where to attach the file" },
        target_key: { type: "string", description: "Jira issue key (e.g. PROJ-123) or Confluence page ID" },
      },
      required: ["filename", "target_type", "target_key"],
    },
    product: "jira" as const,
    operation: "write" as const,
  };

  const chatHandler = async (req: any, res: any) => {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    const message = req.body?.message as string | undefined;
    if (!message) {
      res.status(400).json({ error: "Missing message" });
      return;
    }

    // Parse uploaded files if present
    const uploadedFiles: ParsedFile[] = [];
    const multerFiles = (req.files ?? []) as Array<{ buffer: Buffer; originalname: string; mimetype: string }>;
    log("debug", "File upload debug", {
      hasFiles: !!req.files,
      fileCount: multerFiles.length,
      fileNames: multerFiles.map((f: any) => f.originalname),
      contentType: req.headers?.["content-type"],
    });
    for (const f of multerFiles) {
      try {
        const parsed = await parseFile(f.buffer, f.originalname, f.mimetype);
        uploadedFiles.push(parsed);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
    }

    // Store original file buffers in session for later attachment
    for (const f of multerFiles) {
      session.uploadedFiles.set(f.originalname, {
        buffer: f.buffer,
        filename: f.originalname,
        mimeType: f.mimetype,
      });
    }

    // Build full user message with file content prepended
    const fileContext = formatFilesForPrompt(uploadedFiles);
    const fullUserMessage = fileContext ? `${fileContext}${message}` : message;
    log("debug", "Message sent to AI", {
      parsedFileCount: uploadedFiles.length,
      parsedFileTypes: uploadedFiles.map((f) => `${f.filename}:${f.type}`),
      fileContextLength: fileContext.length,
      fullMessageLength: fullUserMessage.length,
      hasFileContext: fileContext.length > 0,
    });

    // Add user message to session history (text only — images sent separately)
    sessionStore.addMessage(sessionId, { role: "user", content: fullUserMessage });

    // Create Atlassian clients + scrubber for this user
    const fetchOptions = session.authType === "oauth" && session.oauthTokens
      ? {
          authMode: "oauth" as const,
          onTokenRefresh: async (): Promise<string | null> => {
            if (!config.oauth || !session.oauthTokens) return null;
            try {
              const res = await fetch("https://auth.atlassian.com/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  grant_type: "refresh_token",
                  client_id: config.oauth.client_id,
                  client_secret: config.oauth.client_secret,
                  refresh_token: session.oauthTokens.refreshToken,
                }),
              });
              if (!res.ok) return null;
              const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
              const newTokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
              };
              sessionStore.updateOAuthTokens(sessionId, newTokens);
              log("info", "OAuth token refreshed", { user: session.credentials.user });
              return data.access_token;
            } catch {
              return null;
            }
          },
        }
      : undefined;
    const executor = createToolExecutor(config, session.credentials, fetchOptions);
    const { clients, scrubber } = executor;

    // Track client disconnect — use res.on("close") not req.on("close")
    // because req "close" fires as soon as the request body is consumed,
    // not when the client actually disconnects.
    const abortedRef = { value: false };
    res.on("close", () => {
      if (!res.writableFinished) {
        abortedRef.value = true;
      }
    });

    // Set streaming response headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.flushHeaders();

    try {
      let assistantResponse: string;

      // Include attach tool if session has files and write is enabled
      const allToolDefs = session.uploadedFiles.size > 0 && (config.features?.jira?.write || config.features?.confluence?.write)
        ? [...toolDefs, attachToolDef]
        : toolDefs;

      log("debug", "Starting AI chat", {
        provider: config.ai.provider,
        toolCount: allToolDefs.length,
        requestId: (req as any).requestId,
      });

      // Build system prompt with user identity and conversation history
      let systemPrompt = buildSystemPrompt(session.credentials.user);
      if (uploadedFiles.length > 0) {
        systemPrompt += "\n\nThe user has uploaded files with their message. The file contents are included in their message. " +
          "When creating items from tabular data (spreadsheets, CSVs), always show a preview of what you plan to create and ask for confirmation before executing bulk operations.";
      }
      if (session.uploadedFiles.size > 0) {
        const fileList = [...session.uploadedFiles.values()]
          .map((f) => `- ${f.filename} (${(f.buffer.length / 1024).toFixed(1)} KB)`)
          .join("\n");
        systemPrompt += `\n\nFiles available in this session (can be attached to Jira issues or Confluence pages using the attach_uploaded_file tool):\n${fileList}`;
      }

      const history = session.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      if (config.ai.provider === "anthropic") {
        // Include images as native vision content blocks for Anthropic
        const imageFiles = uploadedFiles.filter((f) => f.type === "image");
        const anthropicMsgs = history.map((m) => ({
          role: m.role,
          content: m.content as string | Anthropic.ContentBlockParam[],
        }));
        if (imageFiles.length > 0) {
          const lastMsg = anthropicMsgs[anthropicMsgs.length - 1];
          if (lastMsg && lastMsg.role === "user") {
            lastMsg.content = [
              ...imageFiles.map((f) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: f.mimeType as "image/png" | "image/jpeg",
                  data: f.content,
                },
              })),
              { type: "text" as const, text: lastMsg.content as string },
            ];
          }
        }
        assistantResponse = await handleAnthropicChat(
          config, allToolDefs, anthropicMsgs, clients, scrubber, res, abortedRef, log, systemPrompt, session,
        );
      } else {
        assistantResponse = await handleOpenAIChat(
          config, allToolDefs, history, clients, scrubber, res, abortedRef, log, systemPrompt, session,
        );
      }

      // Save assistant response to session
      if (assistantResponse) {
        sessionStore.addMessage(sessionId, { role: "assistant", content: assistantResponse });
      }

    } catch (err: unknown) {
      const classified = classifyError(err);
      log(classified.logLevel, `Chat error: ${err instanceof Error ? err.message : String(err)}`, {
        requestId: (req as any).requestId,
      });

      if (classified.shouldInvalidateSession) {
        sessionStore.destroy(sessionId);
      }

      if (!abortedRef.value) {
        res.write(`\n\n${classified.userMessage}`);
      }
    } finally {
      if (!abortedRef.value) {
        res.end();
      }
    }
  };

  // Register route with optional multer middleware for multipart file uploads
  if (upload) {
    router.post("/api/chat", upload.array("files", 5), chatHandler);
  } else {
    router.post("/api/chat", chatHandler);
  }

  return router;
}
