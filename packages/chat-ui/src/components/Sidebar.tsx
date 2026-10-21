import { useState, useEffect, useRef, useCallback, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { ThemeToggle } from "./ThemeToggle.js";
import type { FeatureConfig, RecentItem, Theme } from "../types.js";
import type { SessionFile } from "./ChatPanel.js";
import type { SavedConversation } from "../chatHistory.js";
import { DEFAULT_SIDEBAR_WIDTH, clampSidebarWidth } from "../sidebarWidth.js";
import type { SavedWorkflow } from "../workflows.js";
import {
  dismissStarterPrompt,
  loadDismissedStarterPrompts,
  saveDismissedStarterPrompts,
} from "../pinnedPrompts.js";

interface SidebarProps {
  features: FeatureConfig | null;
  recentItems: RecentItem[];
  sessionFiles: SessionFile[];
  pinnedPrompts: string[];
  workflows: SavedWorkflow[];
  conversations: SavedConversation[];
  activeConversationId: string | null;
  onSendPrompt: (text: string) => void;
  onTogglePinnedPrompt: (text: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onAddWorkflow: (input: { name: string; prompt: string }) => void;
  onDeleteWorkflow: (id: string) => void;
  onSelectItem: (key: string) => void;
  onFileClick: (file: SessionFile) => void;
  activeDetailKey: string | null;
  theme: Theme;
  onToggleTheme: () => void;
  userName: string;
  onLogout: () => void;
  onCollapse: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

function getStarterPrompts(features: FeatureConfig | null): Array<{ text: string; product: string }> {
  if (!features) return [];
  const prompts: Array<{ text: string; product: string }> = [];
  if (features.jira.read) {
    prompts.push({ text: "Show my open issues assigned to me, sorted by priority", product: "jira" });
    prompts.push({ text: "Summarize the current sprint and call out blockers", product: "jira" });
  }
  if (features.confluence.read) {
    prompts.push({ text: "Find architecture docs updated recently", product: "confluence" });
  }
  if (features.bitbucket.read) {
    prompts.push({ text: "Show open pull requests waiting for review", product: "bitbucket" });
  }
  return prompts.slice(0, 2);
}

const typeColors: Record<string, string> = {
  Bug: "var(--badge-bug)",
  Task: "var(--badge-task)",
  Story: "var(--badge-story)",
  Feature: "var(--badge-task)",
  Subtask: "var(--badge-task)",
};

type SidebarSectionKey = "pinned" | "workflows" | "conversations" | "starters" | "files" | "recent";

const SIDEBAR_SECTIONS_KEY = "foxbridge_ui_sidebar_sections";

const DEFAULT_SECTION_STATE: Record<SidebarSectionKey, boolean> = {
  pinned: true,
  workflows: true,
  conversations: true,
  starters: true,
  files: true,
  recent: true,
};

function loadSidebarSections(): Record<SidebarSectionKey, boolean> {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (!stored) return DEFAULT_SECTION_STATE;
    const parsed = JSON.parse(stored) as Partial<Record<SidebarSectionKey, boolean>>;
    return { ...DEFAULT_SECTION_STATE, ...parsed };
  } catch {
    return DEFAULT_SECTION_STATE;
  }
}

function saveSidebarSections(sections: Record<SidebarSectionKey, boolean>): void {
  try {
    window.localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(sections));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

function CollapsibleSection({ title, isOpen, onToggle, actions, children }: CollapsibleSectionProps) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
        <button
          type="button"
          onClick={onToggle}
          title={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
            color: "var(--text-muted)",
            fontFamily: "inherit",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            lineHeight: 1,
            textAlign: "left",
            textTransform: "uppercase",
          }}
        >
          <span aria-hidden="true" style={{ width: "16px", fontSize: "14px", lineHeight: 1 }}>
            {isOpen ? "\u25BE" : "\u25B8"}
          </span>
          <span>{title}</span>
        </button>
        {actions}
      </div>
      {isOpen && children}
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Sidebar({
  features, recentItems, sessionFiles, pinnedPrompts, workflows, conversations, activeConversationId,
  onSendPrompt, onTogglePinnedPrompt, onNewConversation, onSelectConversation, onDeleteConversation,
  onAddWorkflow, onDeleteWorkflow, onSelectItem, onFileClick, activeDetailKey,
  theme, onToggleTheme, userName, onLogout, onCollapse,
  width,
  onWidthChange,
}: SidebarProps) {
  const [dismissedStarterPrompts, setDismissedStarterPrompts] = useState<string[]>(loadDismissedStarterPrompts);
  const [sections, setSections] = useState<Record<SidebarSectionKey, boolean>>(loadSidebarSections);
  const [showWorkflowForm, setShowWorkflowForm] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowPrompt, setWorkflowPrompt] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [resizing, setResizing] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const cleanupResizeRef = useRef<(() => void) | null>(null);
  const panelWidth = clampSidebarWidth(width ?? DEFAULT_SIDEBAR_WIDTH);
  const starterPrompts = getStarterPrompts(features).filter(
    (prompt) => !dismissedStarterPrompts.includes(prompt.text) && !pinnedPrompts.includes(prompt.text),
  );

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  useEffect(() => { saveDismissedStarterPrompts(dismissedStarterPrompts); }, [dismissedStarterPrompts]);
  useEffect(() => { saveSidebarSections(sections); }, [sections]);

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.();
    };
  }, []);

  const dismissStarter = (text: string) => {
    setDismissedStarterPrompts((prev) => dismissStarterPrompt(prev, text));
  };

  const toggleSection = (section: SidebarSectionKey) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const saveWorkflow = () => {
    const name = workflowName.trim();
    const prompt = workflowPrompt.trim();
    if (!name || !prompt) return;
    onAddWorkflow({ name, prompt });
    setWorkflowName("");
    setWorkflowPrompt("");
    setShowWorkflowForm(false);
  };

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
      changeWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
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

  const initials = userName.split(/[@.]/).map((s) => s[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");

  return (
    <div style={{
      width: `${panelWidth}px`,
      flexShrink: 0,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "12px",
      gap: "4px",
      overflow: "hidden",
      position: "relative",
      userSelect: resizing ? "none" : undefined,
    }}>
      {onWidthChange && (
        <button
          type="button"
          aria-label="Resize sidebar"
          onPointerDown={handleResizePointerDown}
          style={{
            position: "absolute", right: "-4px", top: 0, bottom: 0, width: "8px",
            padding: 0, border: "none", background: resizing ? "var(--primary)" : "transparent",
            opacity: resizing ? 0.35 : 1, cursor: "col-resize", zIndex: 2,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ color: "var(--primary)", fontWeight: 700, fontSize: "16px" }}>
          Foxbridge
        </div>
        <button
          onClick={onCollapse}
          title="Collapse sidebar"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "16px", padding: "2px 4px",
            lineHeight: 1, borderRadius: "4px",
          }}
        >
          &#x276E;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "2px" }}>
        <CollapsibleSection
          title="Pinned Prompts"
          isOpen={sections.pinned}
          onToggle={() => toggleSection("pinned")}
        >
          {pinnedPrompts.length === 0 ? (
            <div style={{ padding: "4px 8px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Pin prompts from sent messages
            </div>
          ) : (
            pinnedPrompts.map((text) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => onSendPrompt(text)}
                  style={{
                    flex: 1,
                    background: "var(--bg-prompt)",
                    padding: "5px 8px",
                    border: "none",
                    borderRadius: "4px",
                    color: "var(--primary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    lineHeight: 1.35,
                    wordBreak: "break-word",
                  }}
                >
                  {text}
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePinnedPrompt(text)}
                  title="Unpin prompt"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "var(--primary)",
                    padding: "3px 2px",
                    lineHeight: 1,
                  }}
                >
                  {"\u2605"}
                </button>
              </div>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Workflows"
          isOpen={sections.workflows}
          onToggle={() => toggleSection("workflows")}
          actions={
            <button
              type="button"
              onClick={() => setShowWorkflowForm((prev) => !prev)}
              title="Add workflow"
              style={{
                width: "22px",
                height: "22px",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                background: showWorkflowForm ? "var(--bg-hover)" : "var(--bg-panel)",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: "15px",
                lineHeight: 1,
              }}
            >
              +
            </button>
          }
        >
          {showWorkflowForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px 0" }}>
              <input
                value={workflowName}
                onChange={(event) => setWorkflowName(event.target.value)}
                placeholder="Workflow name"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  background: "var(--bg-input)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  padding: "6px 7px",
                }}
              />
              <textarea
                value={workflowPrompt}
                onChange={(event) => setWorkflowPrompt(event.target.value)}
                placeholder="Workflow prompt"
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  background: "var(--bg-input)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  padding: "6px 7px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={saveWorkflow}
                  disabled={!workflowName.trim() || !workflowPrompt.trim()}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: "4px",
                    background: "var(--primary)",
                    color: "var(--text-on-primary)",
                    cursor: workflowName.trim() && workflowPrompt.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "6px",
                    opacity: workflowName.trim() && workflowPrompt.trim() ? 1 : 0.55,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowName("");
                    setWorkflowPrompt("");
                    setShowWorkflowForm(false);
                  }}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--bg-panel)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    padding: "6px 8px",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {workflows.length === 0 ? (
            <div style={{ padding: "4px 8px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Save reusable prompts here
            </div>
          ) : (
            workflows.map((workflow) => (
              <div key={workflow.id} style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => onSendPrompt(workflow.prompt)}
                  style={{
                    flex: 1,
                    background: "var(--bg-prompt)",
                    border: "none",
                    borderRadius: "4px",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: "6px 8px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "block", color: "var(--primary)", fontSize: "12px", fontWeight: 600, lineHeight: 1.25 }}>
                    {workflow.name}
                  </span>
                  {workflow.description && (
                    <span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px", lineHeight: 1.25, marginTop: "2px" }}>
                      {workflow.description}
                    </span>
                  )}
                </button>
                {workflow.source === "custom" && (
                  <button
                    type="button"
                    onClick={() => onDeleteWorkflow(workflow.id)}
                    title="Delete workflow"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "var(--text-muted)",
                      padding: "3px 2px",
                      lineHeight: 1,
                    }}
                  >
                    {"\u00D7"}
                  </button>
                )}
              </div>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Recent Conversations"
          isOpen={sections.conversations}
          onToggle={() => toggleSection("conversations")}
          actions={
            <button
              type="button"
              onClick={onNewConversation}
              title="New conversation"
              style={{
                width: "22px",
                height: "22px",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                background: "var(--bg-panel)",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: "15px",
                lineHeight: 1,
              }}
            >
              +
            </button>
          }
        >
          {conversations.length === 0 ? (
            <div style={{ padding: "4px 8px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Conversations appear here
            </div>
          ) : (
            conversations.map((conversation) => (
              <div key={conversation.id} style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  style={{
                    flex: 1,
                    background: activeConversationId === conversation.id ? "var(--bg-hover)" : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    lineHeight: 1.35,
                    padding: "5px 8px",
                    textAlign: "left",
                    wordBreak: "break-word",
                  }}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteConversation(conversation.id)}
                  title="Delete conversation"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "var(--text-muted)",
                    padding: "3px 2px",
                    lineHeight: 1,
                  }}
                >
                  {"\u00D7"}
                </button>
              </div>
            ))
          )}
        </CollapsibleSection>

        {starterPrompts.length > 0 && (
          <CollapsibleSection
            title="Starter Prompts"
            isOpen={sections.starters}
            onToggle={() => toggleSection("starters")}
          >
            {starterPrompts.map((prompt) => (
            <div key={prompt.text} style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
              <button
                type="button"
                onClick={() => onSendPrompt(prompt.text)}
                style={{
                  flex: 1,
                  background: "var(--bg-prompt)",
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: "4px",
                  color: "var(--primary)",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                }}
              >
                {prompt.text}
              </button>
              <button
                type="button"
                onClick={() => dismissStarter(prompt.text)}
                title="Dismiss starter prompt"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  padding: "1px 2px",
                  lineHeight: 1,
                }}
              >
                {"\u00D7"}
              </button>
            </div>
            ))}
          </CollapsibleSection>
        )}

        {sessionFiles.length > 0 && (
          <CollapsibleSection
            title="Files"
            isOpen={sections.files}
            onToggle={() => toggleSection("files")}
          >
            {sessionFiles.map((f) => (
            <div
              key={f.name}
              onClick={() => onFileClick(f)}
              title={`Click to add ${f.name} to your next message`}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", fontSize: "12px", cursor: "pointer",
                borderRadius: "3px", background: "transparent",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                {f.name}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "10px", flexShrink: 0 }}>
                {formatFileSize(f.size)}
              </span>
            </div>
            ))}
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Recent Items"
          isOpen={sections.recent}
          onToggle={() => toggleSection("recent")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recentItems.length === 0 ? (
              <div style={{ padding: "4px 8px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                Items appear here as you chat
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => onSelectItem(item.key)}
                  style={{
                    padding: "3px 8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    borderRadius: "3px",
                    background: activeDetailKey === item.key ? "var(--bg-hover)" : "transparent",
                  }}
                >
                  <span style={{
                    color: typeColors[item.type] ?? "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 600,
                    marginRight: "4px",
                  }}>
                    {item.type.toUpperCase().slice(0, 4)}
                  </span>
                  <span style={{ color: "var(--primary)" }}>{item.key}</span>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer: theme + user */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <div
            onClick={() => setShowUserMenu((prev) => !prev)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              cursor: "pointer", padding: "4px", borderRadius: "6px",
              background: showUserMenu ? "var(--bg-hover)" : "transparent",
              transition: "background 0.15s",
            }}
          >
            <div style={{
              width: "24px", height: "24px", borderRadius: "50%", background: "var(--primary)",
              color: "var(--text-on-primary)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 600, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {userName}
            </div>
          </div>
          {showUserMenu && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0, right: 0,
              marginBottom: "4px", background: "var(--bg-panel)",
              border: "1px solid var(--border)", borderRadius: "6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)", overflow: "hidden",
            }}>
              <button
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                style={{
                  width: "100%", padding: "8px 12px", background: "none",
                  border: "none", cursor: "pointer", fontSize: "12px",
                  color: "var(--text)", textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
