import { useCallback, useRef, useEffect, type ReactElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { ChatMessage } from "../types.js";

interface MessageBubbleProps {
  message: ChatMessage;
  onIssueClick?: (key: string) => void;
  onDownload?: (filename: string) => void;
  isPinnedPrompt?: boolean;
  onTogglePinnedPrompt?: (prompt: string) => void;
}

const ISSUE_KEY_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

const markdownStyle = `
  .md p { margin: 0.4em 0; }
  .md p:first-child { margin-top: 0; }
  .md p:last-child { margin-bottom: 0; }
  .md ul, .md ol { margin: 0.4em 0; padding-left: 1.5em; }
  .md li { margin: 0.2em 0; }
  .md code { background: var(--code-bg); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  .md pre { background: var(--code-bg); padding: 0.5em; border-radius: 4px; overflow-x: auto; }
  .md pre code { background: none; padding: 0; }
  .md .table-wrap { overflow-x: auto; margin: 0.5em 0; }
  .md table { border-collapse: collapse; white-space: nowrap; font-size: 0.875rem; }
  .md th, .md td { border: 1px solid var(--table-border); padding: 0.35em 0.6em; text-align: left; }
  .md th { background: var(--table-header-bg); font-weight: 600; }
  .md strong { font-weight: 600; }
  .md a { color: var(--primary); }
  .md h1, .md h2, .md h3, .md h4 { margin: 0.6em 0 0.3em; }
  .md h1 { font-size: 1.2em; }
  .md h2 { font-size: 1.05em; }
  .md h3 { font-size: 1em; }
  .md hr { border: none; border-top: 1px solid var(--border); margin: 0.6em 0; }
`;

// Sandboxed iframe for HTML/chart content.
// allow-scripts without allow-same-origin isolates the frame from the parent entirely.
function HtmlFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function resize() {
      try {
        const body = iframe!.contentDocument?.body;
        if (body) {
          iframe!.style.height = `${body.scrollHeight + 8}px`;
        }
      } catch {
        // cross-origin (no allow-same-origin) — use fixed height fallback
      }
    }

    iframe.addEventListener("load", resize);
    return () => iframe.removeEventListener("load", resize);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-scripts"
      style={{
        width: "100%",
        minHeight: "300px",
        maxHeight: "600px",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        background: "#fff",
        display: "block",
        marginTop: "0.5em",
      }}
      title="HTML content"
    />
  );
}

// Detect if the message content is a full standalone HTML document.
function isFullHtmlDocument(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}


function renderWithIssueLinks(
  text: string,
  onClick?: (key: string) => void,
): (string | ReactElement)[] {
  const parts: (string | ReactElement)[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(ISSUE_KEY_REGEX)) {
    if (match.index! > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const key = match[1];
    parts.push(
      <span
        key={`${key}-${match.index}`}
        onClick={(e) => { e.stopPropagation(); onClick?.(key); }}
        style={{
          color: "var(--primary)",
          textDecoration: "underline",
          cursor: onClick ? "pointer" : "inherit",
          fontWeight: 500,
        }}
      >
        {key}
      </span>,
    );
    lastIndex = match.index! + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function textFromChildren(children: any): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  if (children?.props?.children) return textFromChildren(children.props.children);
  return "";
}

function downloadNameFromLinkText(text: string): string {
  return text.replace(/^Download\s+/i, "").trim() || "foxbridge-document";
}

export function MessageBubble({
  message,
  onIssueClick,
  onDownload,
  isPinnedPrompt = false,
  onTogglePinnedPrompt,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const canPinPrompt = isUser && Boolean(onTogglePinnedPrompt) && message.content.trim().length > 0;

  // Shared helper: process children to make issue keys clickable
  const linkifyChildren = useCallback((children: any) => {
    if (!onIssueClick) return children;
    if (typeof children === "string") return renderWithIssueLinks(children, onIssueClick);
    if (Array.isArray(children)) {
      return children.map((child: any, i: number) =>
        typeof child === "string"
          ? renderWithIssueLinks(child, onIssueClick).map((part, j) =>
              typeof part === "string" ? <span key={`${i}-${j}`}>{part}</span> : part,
            )
          : child,
      );
    }
    return children;
  }, [onIssueClick]);

  const customRenderers = useCallback(() => ({
    table: ({ children }: any) => (
      <div className="table-wrap"><table>{children}</table></div>
    ),
    p: ({ children }: any) => <p>{linkifyChildren(children)}</p>,
    td: ({ children }: any) => <td>{linkifyChildren(children)}</td>,
    li: ({ children }: any) => <li>{linkifyChildren(children)}</li>,
    strong: ({ children }: any) => <strong>{linkifyChildren(children)}</strong>,
    a: ({ href, children }: any) => {
      const isDownload = typeof href === "string" && href.startsWith("/api/download/");
      const downloadName = downloadNameFromLinkText(textFromChildren(children));
      return (
        <a
          href={href}
          download={isDownload ? downloadName : undefined}
          onClick={() => {
            if (isDownload) onDownload?.(downloadName);
          }}
        >
          {linkifyChildren(children)}
        </a>
      );
    },
    code: ({ className, children, ...props }: any) => {
      const isHtml = className === "language-html";
      if (isHtml) {
        return <HtmlFrame html={String(children)} />;
      }
      // inline code (no className) vs fenced code block
      const isBlock = "node" in props;
      return isBlock
        ? <pre><code className={className} {...props}>{children}</code></pre>
        : <code className={className} {...props}>{children}</code>;
    },
  }), [linkifyChildren, onDownload]);

  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      background: isUser ? "var(--bg-user-msg)" : "var(--bg-asst-msg)",
      color: isUser ? "var(--text-on-primary)" : "var(--text)",
      borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
      padding: "0.625rem 0.875rem",
      maxWidth: isUser ? "75%" : "95%",
      wordBreak: "break-word",
      border: isUser ? "none" : "1px solid var(--border-msg)",
    }}>
      <style>{markdownStyle}</style>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        marginBottom: "0.25rem",
        opacity: 0.7,
      }}>
        <span>{isUser ? "You" : "FoxBridge"}</span>
        {canPinPrompt && (
          <button
            type="button"
            title={isPinnedPrompt ? "Unpin prompt" : "Pin prompt"}
            aria-label={isPinnedPrompt ? "Unpin prompt" : "Pin prompt"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePinnedPrompt?.(message.content);
            }}
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "none",
              borderRadius: "4px",
              color: "inherit",
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            {isPinnedPrompt ? "\u2605" : "\u2606"}
          </button>
        )}
      </div>
      {isUser ? (
        <p style={{ fontSize: "1rem", lineHeight: 1.5, margin: 0 }}>
          {message.content || "..."}
        </p>
      ) : isFullHtmlDocument(message.content || "") ? (
        <HtmlFrame html={message.content || ""} />
      ) : (
        <div className="md" style={{ fontSize: "1rem", lineHeight: 1.5 }}>
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={customRenderers()}>
            {message.content || "..."}
          </Markdown>
        </div>
      )}
    </div>
  );
}
