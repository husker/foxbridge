import { extname } from "node:path";
import { createRequire } from "node:module";

export interface ParsedFile {
  filename: string;
  type: "text" | "image";
  /** For text files: the extracted text content. For images: base64-encoded data. */
  content: string;
  /** MIME type (relevant for images passed to AI providers). */
  mimeType: string;
}

const MAX_TEXT_BYTES = 100 * 1024; // 100 KB
const MAX_ROWS = 500;
const MAX_COLS = 50;

const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
const SPREADSHEET_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function truncateText(text: string): string {
  if (Buffer.byteLength(text, "utf-8") <= MAX_TEXT_BYTES) return text;
  // Slice bytes, then decode back (may clip a multi-byte char, but safe enough)
  const buf = Buffer.from(text, "utf-8").subarray(0, MAX_TEXT_BYTES);
  return buf.toString("utf-8") + "\n...[truncated]";
}

function spreadsheetToMarkdown(buffer: Buffer): string {
  // xlsx is CJS-only (no "exports" field); use createRequire to load it from ESM
  const require = createRequire(import.meta.url);
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as string[][];

    // Cap dimensions
    const capped = rows.slice(0, MAX_ROWS).map((row) =>
      row.slice(0, MAX_COLS).map((cell) => String(cell ?? "")),
    );

    if (capped.length === 0) continue;

    // Build markdown table
    const header = capped[0] ?? [];
    const divider = header.map(() => "---");
    const tableRows = [
      "| " + header.join(" | ") + " |",
      "| " + divider.join(" | ") + " |",
      ...capped.slice(1).map((r) => "| " + r.join(" | ") + " |"),
    ];

    if (workbook.SheetNames.length > 1) {
      parts.push(`### Sheet: ${sheetName}\n\n${tableRows.join("\n")}`);
    } else {
      parts.push(tableRows.join("\n"));
    }

    if (rows.length > MAX_ROWS) {
      parts.push(`\n...[${rows.length - MAX_ROWS} rows truncated]`);
    }
  }

  return truncateText(parts.join("\n\n"));
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return truncateText(result.text);
}

async function parseOfficeDoc(buffer: Buffer): Promise<string> {
  const { OfficeParser } = await import("officeparser");
  const ast = await OfficeParser.parseOffice(buffer);
  const text = await ast.to("text");
  return truncateText(text.value);
}

/**
 * Parse a file buffer into structured content suitable for AI consumption.
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ParsedFile> {
  const ext = extname(filename).toLowerCase();

  // Plain text / markdown
  if (TEXT_EXTENSIONS.has(ext)) {
    return {
      filename,
      type: "text",
      content: truncateText(buffer.toString("utf-8")),
      mimeType,
    };
  }

  // Spreadsheets / CSV
  if (SPREADSHEET_EXTENSIONS.has(ext)) {
    return {
      filename,
      type: "text",
      content: spreadsheetToMarkdown(buffer),
      mimeType,
    };
  }

  // PDF
  if (ext === ".pdf") {
    return {
      filename,
      type: "text",
      content: await parsePdf(buffer),
      mimeType,
    };
  }

  // Office documents (DOCX, PPTX)
  if (ext === ".docx" || ext === ".pptx") {
    return {
      filename,
      type: "text",
      content: await parseOfficeDoc(buffer),
      mimeType,
    };
  }

  // Images — base64 encode, return as image type
  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      filename,
      type: "image",
      content: buffer.toString("base64"),
      mimeType,
    };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Format an array of parsed files into a text block suitable for prepending to a user prompt.
 * Image files are skipped here — they should be handled separately as content blocks.
 */
export function formatFilesForPrompt(files: ParsedFile[]): string {
  const textFiles = files.filter((f) => f.type === "text");
  if (textFiles.length === 0) return "";

  const blocks = textFiles.map(
    (f) =>
      `--- File: ${f.filename} ---\n${f.content}\n--- End: ${f.filename} ---`,
  );

  return blocks.join("\n\n") + "\n\n";
}
