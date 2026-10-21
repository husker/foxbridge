const PINNED_PROMPTS_KEY = "foxbridge_ui_pinned_prompts";
const DISMISSED_STARTER_PROMPTS_KEY = "foxbridge_ui_dismissed_starter_prompts";
const MAX_PINNED_PROMPTS = 20;

function readStringArray(key: string): string[] {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function cleanPrompt(prompt: string): string {
  return prompt.trim();
}

export function loadPinnedPrompts(): string[] {
  return readStringArray(PINNED_PROMPTS_KEY);
}

export function savePinnedPrompts(prompts: string[]): void {
  writeStringArray(PINNED_PROMPTS_KEY, prompts);
}

export function pinPrompt(prompts: string[], prompt: string): string[] {
  const cleaned = cleanPrompt(prompt);
  if (!cleaned || prompts.includes(cleaned)) return prompts;
  return [cleaned, ...prompts].slice(0, MAX_PINNED_PROMPTS);
}

export function unpinPrompt(prompts: string[], prompt: string): string[] {
  const cleaned = cleanPrompt(prompt);
  return prompts.filter((item) => item !== cleaned);
}

export function togglePinnedPrompt(prompts: string[], prompt: string): string[] {
  const cleaned = cleanPrompt(prompt);
  if (!cleaned) return prompts;
  return prompts.includes(cleaned) ? unpinPrompt(prompts, cleaned) : pinPrompt(prompts, cleaned);
}

export function loadDismissedStarterPrompts(): string[] {
  return readStringArray(DISMISSED_STARTER_PROMPTS_KEY);
}

export function saveDismissedStarterPrompts(prompts: string[]): void {
  writeStringArray(DISMISSED_STARTER_PROMPTS_KEY, prompts);
}

export function dismissStarterPrompt(prompts: string[], prompt: string): string[] {
  const cleaned = cleanPrompt(prompt);
  if (!cleaned || prompts.includes(cleaned)) return prompts;
  return [...prompts, cleaned];
}
