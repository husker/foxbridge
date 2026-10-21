// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adfToText(adf: any): string {
  if (!adf) return "";
  if (typeof adf === "string") return adf;
  if (adf.type === "text") return adf.text ?? "";

  const parts: string[] = [];
  if (Array.isArray(adf.content)) {
    for (const child of adf.content) {
      parts.push(adfToText(child));
    }
  }

  // Add newlines between block-level elements
  if (adf.type === "paragraph" || adf.type === "heading") {
    return parts.join("") + "\n";
  }

  return parts.join("");
}

export function textToAdf(text: string): Record<string, unknown> {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}
