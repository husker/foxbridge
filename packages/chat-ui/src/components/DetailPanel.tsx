import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { fetchIssue } from "../api.js";
import { DEFAULT_DETAIL_PANEL_WIDTH, clampDetailPanelWidth } from "../detailPanelWidth.js";
import { openExternalUrl } from "../openExternalUrl.js";
import type { JiraIssueDetail, JiraComment } from "../types.js";
import { JiraWikiContent } from "./JiraWikiContent.js";

interface DetailPanelProps {
  issueKey: string;
  onClose: () => void;
  atlassianBaseUrl?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const priorityColors: Record<string, string> = {
  Highest: "var(--badge-highest)",
  High: "var(--badge-high)",
  Medium: "var(--badge-medium)",
  Low: "var(--badge-low)",
  Lowest: "var(--badge-low)",
};

const typeColors: Record<string, string> = {
  Bug: "var(--badge-bug)",
  Task: "var(--badge-task)",
  Story: "var(--badge-story)",
  Feature: "var(--badge-task)",
  Subtask: "var(--badge-task)",
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      background: color + "22", color, padding: "2px 6px",
      borderRadius: "3px", fontSize: "11px", fontWeight: 500,
    }}>
      {text}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function buildJiraBrowseUrl(atlassianBaseUrl: string, issueKey: string): string {
  return `${atlassianBaseUrl.replace(/\/+$/, "")}/browse/${encodeURIComponent(issueKey)}`;
}

export function DetailPanel({ issueKey, onClose, atlassianBaseUrl, width, onWidthChange }: DetailPanelProps) {
  const [issue, setIssue] = useState<JiraIssueDetail | null>(null);
  const [comments, setComments] = useState<JiraComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);
  const panelWidth = clampDetailPanelWidth(width ?? DEFAULT_DETAIL_PANEL_WIDTH);
  const jiraBrowseUrl = atlassianBaseUrl ? buildJiraBrowseUrl(atlassianBaseUrl, issueKey) : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchIssue(issueKey)
      .then(({ issue, comments }) => {
        if (cancelled) return;
        setIssue(issue);
        setComments(comments);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [issueKey]);

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.();
    };
  }, []);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onWidthChange) return;

    event.preventDefault();
    cleanupResizeRef.current?.();

    const changeWidth = onWidthChange;
    const startX = event.clientX;
    const startWidth = panelWidth;

    function cleanup() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      cleanupResizeRef.current = null;
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();
      changeWidth(clampDetailPanelWidth(startWidth + startX - moveEvent.clientX));
    }

    function handlePointerEnd() {
      cleanup();
      setResizing(false);
    }

    setResizing(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    cleanupResizeRef.current = cleanup;
  }, [onWidthChange, panelWidth]);

  return (
    <div style={{
      width: `${panelWidth}px`, flexShrink: 0, background: "var(--bg-panel)",
      borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative", userSelect: resizing ? "none" : undefined,
    }}>
      {onWidthChange && (
        <button
          type="button"
          aria-label="Resize ticket detail panel"
          onPointerDown={handleResizePointerDown}
          style={{
            position: "absolute", left: "-4px", top: 0, bottom: 0, width: "8px",
            padding: 0, border: "none", background: resizing ? "var(--primary)" : "transparent",
            opacity: resizing ? 0.35 : 1, cursor: "col-resize", zIndex: 2,
          }}
        />
      )}

      {/* Header */}
      <div style={{
        padding: "12px 14px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px" }}>{issueKey}</div>
          {issue && (
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <Badge text={issue.issueType} color={typeColors[issue.issueType] ?? "var(--text-muted)"} />
              {issue.priority && <Badge text={issue.priority} color={priorityColors[issue.priority] ?? "var(--text-muted)"} />}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)",
          fontSize: "20px", cursor: "pointer", lineHeight: 1, padding: "0 2px",
        }}>
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", fontSize: "12px" }}>
        {loading && <div style={{ color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>Loading...</div>}

        {error && <div style={{ color: "var(--badge-bug)", padding: "20px 0", textAlign: "center" }}>{error}</div>}

        {issue && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontWeight: 600, fontSize: "14px", lineHeight: 1.4 }}>{issue.summary}</div>

            {/* Metadata grid */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "6px", color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 500 }}>Status</span>
              <span style={{ color: "var(--text)" }}>{issue.status}</span>

              <span style={{ fontWeight: 500 }}>Assignee</span>
              <span style={{ color: issue.assignee ? "var(--text)" : "var(--text-muted)" }}>
                {issue.assignee ?? "Unassigned"}
              </span>

              <span style={{ fontWeight: 500 }}>Reporter</span>
              <span style={{ color: "var(--text)" }}>{issue.reporter ?? "Unknown"}</span>

              <span style={{ fontWeight: 500 }}>Created</span>
              <span style={{ color: "var(--text)" }}>{formatDate(issue.created)}</span>

              {issue.labels.length > 0 && (
                <>
                  <span style={{ fontWeight: 500 }}>Labels</span>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                    {issue.labels.map((l) => (
                      <span key={l} style={{
                        background: "var(--label-bg)", color: "var(--label-text)",
                        padding: "1px 6px", borderRadius: "3px", fontSize: "11px",
                      }}>
                        {l}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            {issue.description && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <div style={{ fontWeight: 500, color: "var(--text-secondary)", marginBottom: "4px" }}>Description</div>
                <JiraWikiContent text={issue.description} />
              </div>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <div style={{ fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Comments ({comments.length})
                </div>
                {comments.slice(-3).map((c) => (
                  <div key={c.id} style={{
                    background: "var(--bg-chat)", padding: "8px", borderRadius: "4px",
                    marginBottom: "6px", lineHeight: 1.4,
                  }}>
                    <div style={{ fontWeight: 500, color: "var(--text)" }}>
                      {c.author} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{"\u00B7"} {timeAgo(c.created)}</span>
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <JiraWikiContent text={c.body} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Open in Jira link */}
            {jiraBrowseUrl && (
            <a
              href={jiraBrowseUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={jiraBrowseUrl}
              onClick={(event) => {
                event.preventDefault();
                void openExternalUrl(jiraBrowseUrl).catch((err) => {
                  console.error("Failed to open Jira issue URL", err);
                });
              }}
              style={{ color: "var(--primary)", fontSize: "12px", textDecoration: "none", marginTop: "4px" }}
            >
              Open in Jira {"\u2192"}
            </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
