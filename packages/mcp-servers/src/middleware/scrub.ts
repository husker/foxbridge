import type { PiiScrubber } from "@foxbridge/scrubber";

export function scrubToolResult(text: string, scrubber: PiiScrubber | null): string {
  if (!scrubber) return text;
  return scrubber.scrubText(text);
}
