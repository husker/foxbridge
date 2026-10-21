import { useState, useRef, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { sendMessage } from "../api.js";
import { MessageBubble } from "./MessageBubble.js";
import { ToolActivity } from "./ToolActivity.js";
import { FileChip } from "./FileChip.js";
import type { ChatMessage, RecentItem } from "../types.js";

export interface SessionFile {
  name: string;
  size: number;
  file: File;
}

interface ChatPanelProps {
  onIssueClick: (key: string) => void;
  onRecentItemsFound: (items: RecentItem[]) => void;
  onSessionFilesChanged?: (files: SessionFile[]) => void;
  onFileReattach?: never; // files added externally via addFiles
  externalMessage?: string | null;
  onExternalMessageConsumed?: () => void;
  externalFiles?: File[];
  onExternalFilesConsumed?: () => void;
  pinnedPrompts?: string[];
  onTogglePinnedPrompt?: (prompt: string) => void;
  conversationId?: string;
  initialMessages?: ChatMessage[];
  onMessagesChanged?: (messages: ChatMessage[]) => void;
}

const ISSUE_KEY_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg";

function extractIssueKeys(text: string): string[] {
  const matches = text.match(ISSUE_KEY_REGEX);
  return matches ? [...new Set(matches)] : [];
}

export function ChatPanel({
  onIssueClick, onRecentItemsFound, onSessionFilesChanged,
  externalMessage, onExternalMessageConsumed,
  externalFiles, onExternalFilesConsumed,
  pinnedPrompts = [], onTogglePinnedPrompt,
  conversationId,
  initialMessages = [],
  onMessagesChanged,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionFiles, setSessionFiles] = useState<SessionFile[]>([]);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [attachHover, setAttachHover] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setMessages(initialMessages);
    setFiles([]);
    setError(null);
    setToolActivity(null);
    setDownloadNotice(null);
  }, [conversationId]);

  useEffect(() => {
    onMessagesChanged?.(messages);
  }, [messages, onMessagesChanged]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount and after sending
  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  useEffect(() => {
    if (!downloadNotice) return;

    const timeoutId = window.setTimeout(() => setDownloadNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [downloadNotice]);

  // Handle external messages from sidebar prompts
  useEffect(() => {
    if (externalMessage) {
      handleSendText(externalMessage);
      onExternalMessageConsumed?.();
    }
  }, [externalMessage]);

  // Handle files added from sidebar (click-to-reattach)
  useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      addFiles(externalFiles);
      onExternalFilesConsumed?.();
    }
  }, [externalFiles]);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES);
      const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        setError("Total file size exceeds 25MB");
        return prev;
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendText = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    const filesToSend = [...files];
    setInput("");
    setFiles([]);
    setError(null);
    setSending(true);
    setToolActivity(null);

    // Track uploaded files in session list (deduplicate by name)
    if (filesToSend.length > 0) {
      setSessionFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name));
        const newEntries = filesToSend
          .filter((f) => !existing.has(f.name))
          .map((f) => ({ name: f.name, size: f.size, file: f }));
        const updated = [...prev, ...newEntries];
        onSessionFilesChanged?.(updated);
        return updated;
      });
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const finalText = await sendMessage(
        text,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: chunk };
            return updated;
          });
        },
        (activity) => setToolActivity(activity),
        filesToSend.length > 0 ? filesToSend : undefined,
      );

      setToolActivity(null);
      if (finalText) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { role: "assistant", content: finalText };
          }
          return updated;
        });
      }

      const keys = extractIssueKeys(finalText);
      if (keys.length > 0) {
        onRecentItemsFound(keys.map((k) => ({ key: k, type: "Issue", summary: "" })));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setError(msg);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setSending(false);
      setToolActivity(null);
    }
  }, [sending, files, onRecentItemsFound]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendText(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText(input.trim());
    }
  };

  const handleDownload = useCallback((filename: string) => {
    setDownloadNotice(`Download started: ${filename}`);
  }, []);

  const hasMessages = messages.length > 0;

  const inputBar = (
    <div style={{
      width: "100%",
      maxWidth: hasMessages ? "720px" : "720px",
      padding: hasMessages ? "12px 16px" : "0 16px",
      transition: "all 0.3s ease",
    }}>
      <form onSubmit={handleSubmit} style={{
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: hasMessages ? "16px" : "20px",
        padding: hasMessages ? "8px 8px 8px 16px" : "12px 12px 12px 20px",
        boxShadow: hasMessages
          ? "0 1px 6px rgba(0,0,0,0.06)"
          : "0 2px 12px rgba(0,0,0,0.08)",
        transition: "all 0.3s ease",
      }}>
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", width: "100%" }}>
            {files.map((f, i) => (
              <FileChip key={`${f.name}-${i}`} file={f} onRemove={() => removeFile(i)} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          onMouseEnter={() => setAttachHover(true)}
          onMouseLeave={() => setAttachHover(false)}
          style={{
            width: "32px",
            height: "32px",
            background: attachHover && !sending ? "var(--bg-hover)" : "transparent",
            border: "none",
            borderRadius: "8px",
            cursor: sending ? "default" : "pointer",
            color: sending ? "var(--text-muted)" : attachHover ? "var(--primary)" : "var(--text-secondary)",
            padding: "4px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            alignSelf: "center",
            justifyContent: "center",
            opacity: sending ? 0.55 : 1,
            transition: "background 0.15s ease, color 0.15s ease",
          }}
          title="Attach files"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your Atlassian data..."
          disabled={sending}
          rows={1}
          style={{
            flex: 1,
            padding: hasMessages ? "6px 0" : "4px 0",
            border: "none",
            outline: "none",
            resize: "none",
            fontSize: "1rem",
            lineHeight: "1.5",
            background: "transparent",
            color: "var(--text)",
            maxHeight: "120px",
            overflow: "auto",
            fontFamily: "inherit",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "6px 12px",
            background: (sending || !input.trim()) ? "var(--border)" : "var(--primary)",
            color: "var(--text-on-primary)",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: (sending || !input.trim()) ? "default" : "pointer",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        minWidth: 0, background: "var(--bg-chat)",
        outline: dragOver ? "2px dashed var(--primary)" : "none",
        outlineOffset: "-2px",
      }}
    >
      {!hasMessages ? (
        /* Empty state: centered welcome + input */
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "16px", padding: "0 24px",
        }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "32px", opacity: 0.25, marginBottom: "8px" }}>&#x1F98A;</div>
            <div style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
              Ask anything about your Jira, Confluence, or Bitbucket data
            </div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              Use a starter prompt or pin prompts from sent messages
            </div>
          </div>
          {inputBar}
        </div>
      ) : (
        /* Active chat: messages + input at bottom */
        <>
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "8px",
          }}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onIssueClick={onIssueClick}
                onDownload={handleDownload}
                isPinnedPrompt={msg.role === "user" && pinnedPrompts.includes(msg.content.trim())}
                onTogglePinnedPrompt={onTogglePinnedPrompt}
              />
            ))}
            <ToolActivity activity={toolActivity} />
            {sending && !toolActivity && (
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "4px 12px", fontSize: "0.8125rem", color: "var(--text-muted)",
              }}>
                <span style={{ display: "inline-flex", gap: "2px" }}>
                  <span style={{ animation: "blink 1.4s infinite 0s" }}>.</span>
                  <span style={{ animation: "blink 1.4s infinite 0.2s" }}>.</span>
                  <span style={{ animation: "blink 1.4s infinite 0.4s" }}>.</span>
                </span>
                {" "}Thinking
                <style>{`@keyframes blink { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }`}</style>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div style={{
              padding: "6px 12px", background: "#ffeef0", color: "#c00",
              fontSize: "0.8125rem", textAlign: "center", flexShrink: 0,
            }}>
              {error}
            </div>
          )}

          {downloadNotice && (
            <div
              role="status"
              aria-live="polite"
              style={{
                margin: "0 auto 8px",
                padding: "6px 12px",
                background: "rgba(24, 128, 56, 0.12)",
                border: "1px solid rgba(24, 128, 56, 0.28)",
                borderRadius: "8px",
                color: "var(--text)",
                fontSize: "0.8125rem",
                flexShrink: 0,
                maxWidth: "720px",
                width: "calc(100% - 32px)",
                boxSizing: "border-box",
              }}
            >
              {downloadNotice}
            </div>
          )}

          <div style={{
            flexShrink: 0,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "var(--bg-chat)",
            paddingBottom: "12px",
          }}>
            {inputBar}
          </div>
        </>
      )}
    </div>
  );
}
