import type { ChatMessage } from "./types.js";

export const CHAT_CONVERSATIONS_KEY = "foxbridge_ui_conversations";
const MAX_CONVERSATIONS = 30;
const MAX_TITLE_LENGTH = 72;

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJsonArray(key: string): unknown[] {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, values: unknown[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function cleanMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .map((message) => ({ role: message.role, content: message.content }));
}

function isConversation(value: unknown): value is SavedConversation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SavedConversation;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.messages)
  );
}

export function createConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function summarizeConversation(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "New conversation";
  return firstUserMessage.length > MAX_TITLE_LENGTH
    ? `${firstUserMessage.slice(0, MAX_TITLE_LENGTH - 1)}...`
    : firstUserMessage;
}

export function loadConversations(): SavedConversation[] {
  return readJsonArray(CHAT_CONVERSATIONS_KEY)
    .filter(isConversation)
    .map((conversation) => ({
      ...conversation,
      messages: cleanMessages(conversation.messages),
    }))
    .filter((conversation) => conversation.messages.length > 0)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
}

export function saveConversations(conversations: SavedConversation[]): void {
  writeJsonArray(CHAT_CONVERSATIONS_KEY, conversations.slice(0, MAX_CONVERSATIONS));
}

export function upsertConversation(
  conversations: SavedConversation[],
  id: string,
  messages: ChatMessage[],
): SavedConversation[] {
  const cleanedMessages = cleanMessages(messages);
  if (cleanedMessages.length === 0) return conversations;

  const existing = conversations.find((conversation) => conversation.id === id);
  const timestamp = nowIso();
  const nextConversation: SavedConversation = {
    id,
    title: summarizeConversation(cleanedMessages),
    messages: cleanedMessages,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  return [
    nextConversation,
    ...conversations.filter((conversation) => conversation.id !== id),
  ].slice(0, MAX_CONVERSATIONS);
}

export function deleteConversation(conversations: SavedConversation[], id: string): SavedConversation[] {
  return conversations.filter((conversation) => conversation.id !== id);
}
