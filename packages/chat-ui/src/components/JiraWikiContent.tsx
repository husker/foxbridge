import { createElement, Fragment, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { openExternalUrl } from "../openExternalUrl.js";

interface JiraWikiContentProps {
  text: string;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "panel"; title?: string; blocks: Block[] };

type InlineToken =
  | { type: "text"; text: string }
  | { type: "marker"; marker: "*" | "_" }
  | { type: "code"; text: string }
  | { type: "color"; color: string; text: string }
  | { type: "link"; label: string; url: string }
  | { type: "url"; url: string };

const headingPattern = /^h([1-6])\.\s+(.+)$/;
const listPattern = /^([*#]+)\s+(.+)$/;
const codeFencePattern = /^\{code(?::[^}]*)?\}\s*$/;
const panelPattern = /^\{panel(?::([^}]*))?\}\s*$/;
const safeUrlPattern = /^(?:https?:\/\/|mailto:)/i;
const simpleColorPattern = /^(?:#[0-9a-f]{3,8}|[a-z][a-z0-9-]*)$/i;

const containerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: "var(--text)",
  lineHeight: 1.5,
} satisfies CSSProperties;

const paragraphStyle = {
  margin: 0,
  whiteSpace: "pre-wrap",
} satisfies CSSProperties;

const headingStyle = {
  margin: "2px 0 0",
  color: "var(--text)",
  fontWeight: 650,
  lineHeight: 1.25,
} satisfies CSSProperties;

const listStyle = {
  margin: 0,
  paddingLeft: "20px",
} satisfies CSSProperties;

const inlineCodeStyle = {
  background: "var(--code-bg)",
  borderRadius: "3px",
  padding: "1px 4px",
  fontSize: "0.92em",
} satisfies CSSProperties;

const codeBlockStyle = {
  margin: 0,
  padding: "8px",
  overflowX: "auto",
  background: "var(--code-bg)",
  borderRadius: "4px",
  fontSize: "11px",
  lineHeight: 1.45,
} satisfies CSSProperties;

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: "2px 0",
  padding: "10px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--code-bg)",
} satisfies CSSProperties;

const panelTitleStyle = {
  fontWeight: 650,
  color: "var(--text)",
} satisfies CSSProperties;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let paragraphLines: string[] = [];
  let codeLines: string[] | null = null;
  let panelLines: string[] | null = null;
  let panelTitle: string | undefined;
  let listItems: string[] = [];
  let listOrdered: boolean | null = null;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraphLines });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0 || listOrdered === null) return;
    blocks.push({ type: "list", ordered: listOrdered, items: listItems });
    listItems = [];
    listOrdered = null;
  }

  function flushPanel() {
    if (!panelLines) return;
    blocks.push({
      type: "panel",
      title: panelTitle,
      blocks: parseBlocks(panelLines.join("\n")),
    });
    panelLines = null;
    panelTitle = undefined;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (panelLines) {
      if (panelPattern.test(trimmed)) {
        flushPanel();
      } else {
        panelLines.push(line);
      }
      continue;
    }

    if (codeLines) {
      if (codeFencePattern.test(line.trim())) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (codeFencePattern.test(trimmed)) {
      flushParagraph();
      flushList();
      codeLines = [];
      continue;
    }

    const panel = trimmed.match(panelPattern);
    if (panel) {
      flushParagraph();
      flushList();
      panelTitle = parsePanelTitle(panel[1]);
      panelLines = [];
      continue;
    }

    const heading = trimmed.match(headingPattern);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: Number(heading[1]),
        text: heading[2],
      });
      continue;
    }

    const list = trimmed.match(listPattern);
    if (list) {
      flushParagraph();
      const ordered = list[1][0] === "#";
      if (listOrdered !== null && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listItems.push(list[2]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  if (codeLines) blocks.push({ type: "code", text: codeLines.join("\n") });
  flushPanel();
  flushParagraph();
  flushList();

  return blocks;
}

function parsePanelTitle(attributes: string | undefined): string | undefined {
  if (!attributes) return undefined;
  const title = attributes.match(/(?:^|\|)title=([^|]+)/);
  return title?.[1]?.trim() || undefined;
}

function isSafeExternalUrl(url: string): boolean {
  return safeUrlPattern.test(url);
}

function sanitizeColor(color: string): string | undefined {
  const trimmed = color.trim();
  return simpleColorPattern.test(trimmed) ? trimmed : undefined;
}

function splitTrailingUrlPunctuation(url: string): { url: string; trailing: string } {
  let cleanUrl = url;
  let trailing = "";

  while (/[.,;:!?)]$/.test(cleanUrl)) {
    trailing = cleanUrl.slice(-1) + trailing;
    cleanUrl = cleanUrl.slice(0, -1);
  }

  return { url: cleanUrl, trailing };
}

function readLinkToken(text: string, start: number): InlineToken | null {
  const end = text.indexOf("]", start + 1);
  if (end === -1) return null;

  const link = text.slice(start + 1, end);
  const separator = link.indexOf("|");
  if (separator === -1) return null;

  const label = link.slice(0, separator);
  const url = link.slice(separator + 1);
  if (!isSafeExternalUrl(url)) return null;

  return { type: "link", label, url };
}

function readBareUrlToken(text: string, start: number): { token: InlineToken; consumed: number; trailing: string } | null {
  const match = text.slice(start).match(/^https?:\/\/[^\s<]+/);
  if (!match) return null;

  const { url, trailing } = splitTrailingUrlPunctuation(match[0]);
  return {
    token: { type: "url", url },
    consumed: url.length + trailing.length,
    trailing,
  };
}

function scanInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;
  let textBuffer = "";

  function flushText() {
    if (!textBuffer) return;
    tokens.push({ type: "text", text: textBuffer });
    textBuffer = "";
  }

  while (index < text.length) {
    if (text.startsWith("{{", index)) {
      const end = text.indexOf("}}", index + 2);
      if (end !== -1) {
        flushText();
        tokens.push({ type: "code", text: text.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("{color:", index)) {
      const colorEnd = text.indexOf("}", index + 7);
      const macroEnd = text.indexOf("{color}", colorEnd + 1);
      if (colorEnd !== -1 && macroEnd !== -1) {
        flushText();
        tokens.push({
          type: "color",
          color: text.slice(index + 7, colorEnd),
          text: text.slice(colorEnd + 1, macroEnd),
        });
        index = macroEnd + "{color}".length;
        continue;
      }
    }

    if (text[index] === "[") {
      const linkToken = readLinkToken(text, index);
      if (linkToken) {
        flushText();
        tokens.push(linkToken);
        index = text.indexOf("]", index + 1) + 1;
        continue;
      }
    }

    if (text.startsWith("http://", index) || text.startsWith("https://", index)) {
      const urlToken = readBareUrlToken(text, index);
      if (urlToken) {
        flushText();
        tokens.push(urlToken.token);
        if (urlToken.trailing) tokens.push({ type: "text", text: urlToken.trailing });
        index += urlToken.consumed;
        continue;
      }
    }

    const char = text[index];
    if ((char === "*" || char === "_") && text[index + 1] === char && /\s/.test(text[index + 2] ?? "")) {
      flushText();
      index += 2;
      continue;
    }

    if (char === "*" || char === "_") {
      flushText();
      tokens.push({ type: "marker", marker: char });
      index += 1;
      continue;
    }

    textBuffer += char;
    index += 1;
  }

  flushText();
  return tokens;
}

function hasRenderableToken(tokens: InlineToken[]): boolean {
  return tokens.some((token) => {
    if (token.type === "text") return token.text.trim().length > 0;
    if (token.type === "marker") return false;
    return true;
  });
}

function findClosingMarker(tokens: InlineToken[], start: number, marker: "*" | "_"): number {
  for (let index = start + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "marker" && token.marker === marker && hasRenderableToken(tokens.slice(start + 1, index))) {
      return index;
    }
  }

  return -1;
}

function renderExternalLink(url: string, children: ReactNode, key: string): ReactElement {
  return (
    <a
      key={key}
      href={url}
      title={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        void openExternalUrl(url).catch((err) => {
          console.error("Failed to open Jira wiki link", err);
        });
      }}
      style={{ color: "var(--primary)" }}
    >
      {children}
    </a>
  );
}

function renderTokens(tokens: InlineToken[], keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "text") {
      parts.push(token.text);
      continue;
    }

    if (token.type === "marker") {
      const closeIndex = findClosingMarker(tokens, index, token.marker);
      if (closeIndex === -1) {
        parts.push(token.marker);
        continue;
      }

      const children = renderTokens(tokens.slice(index + 1, closeIndex), `${keyPrefix}-mark-${index}`);
      const MarkTag = token.marker === "*" ? "strong" : "em";
      parts.push(createElement(MarkTag, { key: `${keyPrefix}-mark-${index}` }, children));
      index = closeIndex;
      continue;
    }

    if (token.type === "code") {
      parts.push(
        <code key={`${keyPrefix}-code-${index}`} style={inlineCodeStyle}>
          {token.text}
        </code>,
      );
      continue;
    }

    if (token.type === "color") {
      parts.push(
        <span
          key={`${keyPrefix}-color-${index}`}
          style={sanitizeColor(token.color) ? { color: sanitizeColor(token.color) } : undefined}
        >
          {renderInline(token.text, `${keyPrefix}-color-${index}`)}
        </span>,
      );
      continue;
    }

    if (token.type === "link") {
      parts.push(
        renderExternalLink(token.url, renderInline(token.label, `${keyPrefix}-link-${index}`), `${keyPrefix}-link-${index}`),
      );
      continue;
    }

    parts.push(renderExternalLink(token.url, token.url, `${keyPrefix}-url-${index}`));
  }

  return parts;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return renderTokens(scanInlineTokens(text), keyPrefix);
}

function renderParagraph(block: Extract<Block, { type: "paragraph" }>, index: number, keyPrefix: string): ReactElement {
  return (
    <p key={`${keyPrefix}-paragraph-${index}`} style={paragraphStyle}>
      {block.lines.map((line, lineIndex) => (
        <Fragment key={`${keyPrefix}-paragraph-${index}-line-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {renderInline(line, `${keyPrefix}-paragraph-${index}-line-${lineIndex}`)}
        </Fragment>
      ))}
    </p>
  );
}

function renderBlocks(blocks: Block[], keyPrefix: string): ReactElement[] {
  return blocks.map((block, index) => {
    if (block.type === "heading") {
      return createElement(
        `h${block.level}`,
        {
          key: `${keyPrefix}-heading-${index}`,
          style: {
            ...headingStyle,
            fontSize: block.level <= 2 ? "13px" : "12px",
          },
        },
        renderInline(block.text, `${keyPrefix}-heading-${index}`),
      );
    }

    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return createElement(
        ListTag,
        { key: `${keyPrefix}-list-${index}`, style: listStyle },
        block.items.map((item, itemIndex) => (
          <li key={`${keyPrefix}-list-${index}-item-${itemIndex}`}>
            {renderInline(item, `${keyPrefix}-list-${index}-item-${itemIndex}`)}
          </li>
        )),
      );
    }

    if (block.type === "code") {
      return (
        <pre key={`${keyPrefix}-code-${index}`} style={codeBlockStyle}>
          <code>{block.text}</code>
        </pre>
      );
    }

    if (block.type === "panel") {
      return (
        <div key={`${keyPrefix}-panel-${index}`} role="note" style={panelStyle}>
          {block.title && <div style={panelTitleStyle}>{renderInline(block.title, `${keyPrefix}-panel-${index}-title`)}</div>}
          {renderBlocks(block.blocks, `${keyPrefix}-panel-${index}`)}
        </div>
      );
    }

    return renderParagraph(block, index, keyPrefix);
  });
}

export function JiraWikiContent({ text }: JiraWikiContentProps) {
  const blocks = parseBlocks(text);

  if (blocks.length === 0) return null;

  return <div style={containerStyle}>{renderBlocks(blocks, "jira")}</div>;
}
