export const WORKFLOWS_KEY = "foxbridge_ui_custom_workflows";
const MAX_CUSTOM_WORKFLOWS = 20;

export interface SavedWorkflow {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  source: "default" | "custom";
  createdAt?: string;
}

export const DEFAULT_WORKFLOWS: SavedWorkflow[] = [
  {
    id: "default-morning-triage",
    name: "Morning triage",
    description: "Open issues and blockers",
    prompt: "Show my open issues assigned to me, sorted by priority, and call out anything blocked or overdue.",
    source: "default",
  },
  {
    id: "default-sprint-health",
    name: "Sprint health",
    description: "Progress and risks",
    prompt: "Summarize the current sprint: completed work, remaining work, blockers, and risks that need attention.",
    source: "default",
  },
  {
    id: "default-standup-notes",
    name: "Standup notes",
    description: "Yesterday, today, blockers",
    prompt: "Prepare standup notes from my recent Jira activity: what changed, what I should focus on next, and any blockers.",
    source: "default",
  },
  {
    id: "default-blocker-summary",
    name: "Blocker summary",
    description: "Blocked work only",
    prompt: "Find issues assigned to me or my team that are blocked, explain why they appear blocked, and suggest next actions.",
    source: "default",
  },
];

function readCustomWorkflows(): SavedWorkflow[] {
  try {
    const stored = window.localStorage.getItem(WORKFLOWS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isWorkflow).map((workflow) => ({ ...workflow, source: "custom" })) : [];
  } catch {
    return [];
  }
}

function isWorkflow(value: unknown): value is SavedWorkflow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SavedWorkflow;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.prompt === "string";
}

function createWorkflowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadWorkflows(): SavedWorkflow[] {
  const defaultIds = new Set(DEFAULT_WORKFLOWS.map((workflow) => workflow.id));
  const custom = readCustomWorkflows().filter((workflow) => !defaultIds.has(workflow.id));
  return [...DEFAULT_WORKFLOWS, ...custom].slice(0, DEFAULT_WORKFLOWS.length + MAX_CUSTOM_WORKFLOWS);
}

export function saveCustomWorkflows(workflows: SavedWorkflow[]): void {
  const customWorkflows = workflows
    .filter((workflow) => workflow.source === "custom")
    .slice(0, MAX_CUSTOM_WORKFLOWS);
  try {
    window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(customWorkflows));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function addWorkflow(
  workflows: SavedWorkflow[],
  input: { name: string; prompt: string; description?: string },
): SavedWorkflow[] {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  const description = input.description?.trim();
  if (!name || !prompt) return workflows;
  return [
    ...workflows,
    {
      id: createWorkflowId(),
      name,
      prompt,
      ...(description ? { description } : {}),
      source: "custom" as const,
      createdAt: new Date().toISOString(),
    },
  ].slice(0, DEFAULT_WORKFLOWS.length + MAX_CUSTOM_WORKFLOWS);
}

export function deleteWorkflow(workflows: SavedWorkflow[], id: string): SavedWorkflow[] {
  return workflows.filter((workflow) => workflow.source === "default" || workflow.id !== id);
}
