export type AtlassianPlatform = "cloud" | "datacenter";
export type AiProvider = "anthropic" | "openai" | "azure_openai" | "ollama";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface FeatureToggle {
  read: boolean;
  write: boolean;
}
