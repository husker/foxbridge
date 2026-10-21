import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar.js";
import { ChatPanel, type SessionFile } from "./ChatPanel.js";
import { DetailPanel } from "./DetailPanel.js";
import { fetchFeatures } from "../api.js";
import {
  createConversationId,
  deleteConversation as removeConversation,
  loadConversations,
  saveConversations,
  upsertConversation,
} from "../chatHistory.js";
import { clampDetailPanelWidth, loadDetailPanelWidth, saveDetailPanelWidth } from "../detailPanelWidth.js";
import { loadPinnedPrompts, savePinnedPrompts, togglePinnedPrompt } from "../pinnedPrompts.js";
import { clampSidebarWidth, loadSidebarWidth, saveSidebarWidth } from "../sidebarWidth.js";
import { getStoredTheme, setStoredTheme, applyTheme } from "../theme.js";
import { addWorkflow, deleteWorkflow, loadWorkflows, saveCustomWorkflows } from "../workflows.js";
import type { ChatMessage, FeatureConfig, RecentItem, Theme } from "../types.js";

const MAX_RECENT_ITEMS = 20;

interface WorkspaceProps {
  userName: string;
  onLogout: () => void;
}

export function Workspace({ userName, onLogout }: WorkspaceProps) {
  const [features, setFeatures] = useState<FeatureConfig | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionFiles, setSessionFiles] = useState<SessionFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[] | undefined>(undefined);
  const [detailPanelWidth, setDetailPanelWidth] = useState(loadDetailPanelWidth);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [pinnedPrompts, setPinnedPrompts] = useState(loadPinnedPrompts);
  const [conversations, setConversations] = useState(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState(createConversationId);
  const [activeInitialMessages, setActiveInitialMessages] = useState<ChatMessage[]>([]);
  const [workflows, setWorkflows] = useState(loadWorkflows);

  useEffect(() => {
    fetchFeatures().then(setFeatures).catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    savePinnedPrompts(pinnedPrompts);
  }, [pinnedPrompts]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveCustomWorkflows(workflows);
  }, [workflows]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      setStoredTheme(next);
      return next;
    });
  }, []);

  const handleSendPrompt = useCallback((text: string) => {
    setPendingPrompt(text);
  }, []);

  const handleTogglePinnedPrompt = useCallback((prompt: string) => {
    setPinnedPrompts((prev) => togglePinnedPrompt(prev, prompt));
  }, []);

  const handleMessagesChanged = useCallback((messages: ChatMessage[]) => {
    if (messages.length === 0) return;
    setConversations((prev) => upsertConversation(prev, activeConversationId, messages));
  }, [activeConversationId]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(createConversationId());
    setActiveInitialMessages([]);
    setPendingPrompt(null);
    setPendingFiles(undefined);
    setSessionFiles([]);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    const conversation = conversations.find((candidate) => candidate.id === id);
    if (!conversation) return;
    setActiveConversationId(id);
    setActiveInitialMessages(conversation.messages);
    setPendingPrompt(null);
    setPendingFiles(undefined);
    setSessionFiles([]);
  }, [conversations]);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => removeConversation(prev, id));
    if (id === activeConversationId) {
      setActiveConversationId(createConversationId());
      setActiveInitialMessages([]);
      setPendingPrompt(null);
      setPendingFiles(undefined);
      setSessionFiles([]);
    }
  }, [activeConversationId]);

  const handleAddWorkflow = useCallback((input: { name: string; prompt: string }) => {
    setWorkflows((prev) => addWorkflow(prev, input));
  }, []);

  const handleDeleteWorkflow = useCallback((id: string) => {
    setWorkflows((prev) => deleteWorkflow(prev, id));
  }, []);

  const handleRecentItemsFound = useCallback((items: RecentItem[]) => {
    setRecentItems((prev) => {
      const merged = [...items.filter((i) => !prev.some((p) => p.key === i.key)), ...prev];
      return merged.slice(0, MAX_RECENT_ITEMS);
    });
  }, []);

  const handleIssueClick = useCallback((key: string) => {
    setDetailKey(key);
  }, []);

  const handleFileClick = useCallback((file: SessionFile) => {
    setPendingFiles([file.file]);
  }, []);

  const handleDetailPanelWidthChange = useCallback((width: number) => {
    const nextWidth = clampDetailPanelWidth(width);
    setDetailPanelWidth(nextWidth);
    saveDetailPanelWidth(nextWidth);
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    saveSidebarWidth(nextWidth);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {sidebarOpen ? (
        <Sidebar
          features={features}
          recentItems={recentItems}
          sessionFiles={sessionFiles}
          pinnedPrompts={pinnedPrompts}
          workflows={workflows}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSendPrompt={handleSendPrompt}
          onTogglePinnedPrompt={handleTogglePinnedPrompt}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onAddWorkflow={handleAddWorkflow}
          onDeleteWorkflow={handleDeleteWorkflow}
          onSelectItem={handleIssueClick}
          onFileClick={handleFileClick}
          activeDetailKey={detailKey}
          theme={theme}
          onToggleTheme={toggleTheme}
          userName={userName}
          onLogout={onLogout}
          onCollapse={() => setSidebarOpen(false)}
          width={sidebarWidth}
          onWidthChange={handleSidebarWidthChange}
        />
      ) : (
        /* Collapsed sidebar — just a small expand button */
        <div style={{
          width: "40px", flexShrink: 0,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: "12px",
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            title="Expand sidebar"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "16px", padding: "4px",
              lineHeight: 1, borderRadius: "4px",
            }}
          >
            &#x276F;
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ChatPanel
          onIssueClick={handleIssueClick}
          onRecentItemsFound={handleRecentItemsFound}
          onSessionFilesChanged={setSessionFiles}
          externalMessage={pendingPrompt}
          onExternalMessageConsumed={() => setPendingPrompt(null)}
          externalFiles={pendingFiles}
          onExternalFilesConsumed={() => setPendingFiles(undefined)}
          pinnedPrompts={pinnedPrompts}
          onTogglePinnedPrompt={handleTogglePinnedPrompt}
          conversationId={activeConversationId}
          initialMessages={activeInitialMessages}
          onMessagesChanged={handleMessagesChanged}
        />
      </div>

      {detailKey && (
        <DetailPanel
          issueKey={detailKey}
          onClose={() => setDetailKey(null)}
          atlassianBaseUrl={features?.atlassian_base_url}
          width={detailPanelWidth}
          onWidthChange={handleDetailPanelWidthChange}
        />
      )}
    </div>
  );
}
