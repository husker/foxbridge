import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseFile, formatFilesForPrompt } from "./file-parser.js";

describe("parseFile", () => {
  it("parses plain text files", async () => {
    const buffer = Buffer.from("Hello, world!");
    const result = await parseFile(buffer, "readme.txt", "text/plain");
    expect(result.type).toBe("text");
    expect(result.content).toBe("Hello, world!");
    expect(result.filename).toBe("readme.txt");
    expect(result.mimeType).toBe("text/plain");
  });

  it("parses markdown files", async () => {
    const buffer = Buffer.from("# Title\n\nSome **bold** text.");
    const result = await parseFile(buffer, "notes.md", "text/markdown");
    expect(result.type).toBe("text");
    expect(result.content).toBe("# Title\n\nSome **bold** text.");
    expect(result.filename).toBe("notes.md");
  });

  it("parses CSV files as markdown tables", async () => {
    const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA";
    const buffer = Buffer.from(csv);
    const result = await parseFile(buffer, "data.csv", "text/csv");
    expect(result.type).toBe("text");
    expect(result.content).toContain("| Name | Age | City |");
    expect(result.content).toContain("| --- | --- | --- |");
    expect(result.content).toContain("| Alice | 30 | NYC |");
    expect(result.content).toContain("| Bob | 25 | LA |");
  });

  it("extracts text from a synthetic DOCX using the maintained parser API", async () => {
    const buffer = readFileSync(new URL("../../../tests/fixtures/example.docx", import.meta.url));
    const result = await parseFile(buffer, "example.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(result.type).toBe("text");
    expect(result.content).toContain("Synthetic document for Foxbridge parser tests.");
  });

  it("returns base64 for PNG images", async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const result = await parseFile(buffer, "screenshot.png", "image/png");
    expect(result.type).toBe("image");
    expect(result.content).toBe(buffer.toString("base64"));
    expect(result.mimeType).toBe("image/png");
  });

  it("returns base64 for JPEG images", async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await parseFile(buffer, "photo.jpeg", "image/jpeg");
    expect(result.type).toBe("image");
    expect(result.content).toBe(buffer.toString("base64"));
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("throws for unsupported file types", async () => {
    const buffer = Buffer.from("data");
    await expect(parseFile(buffer, "file.exe", "application/octet-stream")).rejects.toThrow(
      "Unsupported file type: .exe",
    );
  });

  it("truncates large text files to ~100KB", async () => {
    const largeContent = "x".repeat(200 * 1024); // 200 KB
    const buffer = Buffer.from(largeContent);
    const result = await parseFile(buffer, "big.txt", "text/plain");
    expect(result.type).toBe("text");
    // Should be truncated: 100KB of content + truncation marker
    expect(Buffer.byteLength(result.content, "utf-8")).toBeLessThanOrEqual(
      100 * 1024 + 50, // small margin for the truncation marker
    );
    expect(result.content).toContain("...[truncated]");
  });
});

describe("formatFilesForPrompt", () => {
  it("formats text files with delimiters", () => {
    const files = [
      { filename: "a.txt", type: "text" as const, content: "hello", mimeType: "text/plain" },
      { filename: "b.md", type: "text" as const, content: "world", mimeType: "text/markdown" },
    ];
    const result = formatFilesForPrompt(files);
    expect(result).toContain("--- File: a.txt ---");
    expect(result).toContain("hello");
    expect(result).toContain("--- End: a.txt ---");
    expect(result).toContain("--- File: b.md ---");
    expect(result).toContain("world");
  });

  it("skips image files", () => {
    const files = [
      { filename: "img.png", type: "image" as const, content: "base64data", mimeType: "image/png" },
    ];
    const result = formatFilesForPrompt(files);
    expect(result).toBe("");
  });

  it("returns empty string for no files", () => {
    expect(formatFilesForPrompt([])).toBe("");
  });
});
