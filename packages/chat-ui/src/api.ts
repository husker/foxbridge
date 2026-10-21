import type { LoginCredentials, FeatureConfig, JiraIssueDetail, JiraComment } from "./types.js";

export async function fetchSetupStatus(): Promise<{ configured: boolean; configPath: string | null }> {
  const res = await fetch("/api/setup/status");
  if (!res.ok) throw new Error("Failed to fetch setup status");
  return res.json();
}

export async function fetchSession(): Promise<{ authenticated: boolean; user?: string }> {
  const res = await fetch("/api/auth/session");
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function login(credentials: LoginCredentials): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(body.error ?? "Login failed");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchFeatures(): Promise<FeatureConfig> {
  const res = await fetch("/api/config/features");
  if (!res.ok) throw new Error("Failed to fetch features");
  return res.json();
}

export async function fetchIssue(
  key: string,
): Promise<{ issue: JiraIssueDetail; comments: JiraComment[] }> {
  const res = await fetch(`/api/jira/issue/${encodeURIComponent(key)}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired");
    if (res.status === 404) throw new Error(`Issue ${key} not found`);
    throw new Error("Failed to fetch issue");
  }
  return res.json();
}

export async function sendMessage(
  message: string,
  onChunk: (text: string) => void,
  onToolActivity?: (activity: string) => void,
  files?: File[],
): Promise<string> {
  let res: Response;

  if (files && files.length > 0) {
    const form = new FormData();
    form.append("message", message);
    for (const file of files) {
      form.append("files", file);
    }
    res = await fetch("/api/chat", {
      method: "POST",
      body: form,
    });
  } else {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? "Request failed");
  }

  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      // Strip [tool:...] markers, keep everything else including newlines
      const cleaned = chunk.replace(/\[tool:[^\]]+\]\n?/g, (match) => {
        const activity = match.match(/\[tool:(.+)\]/)?.[1];
        if (activity) onToolActivity?.(activity);
        return "";
      });
      full += cleaned;
      onChunk(full);
    }

    return full.trim();
  }

  // Fallback for environments without ReadableStream body
  const text = await res.text();
  onChunk(text);
  return text;
}
