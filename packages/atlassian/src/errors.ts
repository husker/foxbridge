// Atlassian API responses embed human-readable error info in the response body
// using two standard shapes:
//   { errorMessages: string[], errors: Record<string, string> }   (Jira, Confluence)
//   { error: { message: string } }                                (Bitbucket Cloud)
// Raw `${status} ${statusText}` discards that detail, which leaves the AI
// caller with no way to self-correct. This helper preserves it.

export async function throwAtlassianError(res: Response, context: string): Promise<never> {
  let detail = "";
  try {
    const body = await res.text();
    if (body) {
      try {
        const parsed = JSON.parse(body);
        const messages: string[] = [];
        if (Array.isArray(parsed.errorMessages)) {
          for (const m of parsed.errorMessages) if (typeof m === "string") messages.push(m);
        }
        if (parsed.errors && typeof parsed.errors === "object") {
          for (const v of Object.values(parsed.errors)) {
            if (typeof v === "string") messages.push(v);
          }
        }
        if (parsed.error?.message && typeof parsed.error.message === "string") {
          messages.push(parsed.error.message);
        }
        if (messages.length) {
          detail = ` — ${messages.join("; ")}`;
        } else if (typeof parsed.message === "string") {
          detail = ` — ${parsed.message}`;
        }
      } catch {
        const trimmed = body.trim().slice(0, 200);
        if (trimmed) detail = ` — ${trimmed}`;
      }
    }
  } catch {
    // body couldn't be read — fall through with status-only error
  }
  throw new Error(`${context}: ${res.status} ${res.statusText}${detail}`);
}
