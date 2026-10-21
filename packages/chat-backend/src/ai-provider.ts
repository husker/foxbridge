import type { FoxbridgeConfig } from "@foxbridge/config";

export interface AiProviderConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  azure_openai: "gpt-4o",
  ollama: "llama3.1",
};

const SUPPORTED_PROVIDERS = ["anthropic", "openai", "azure_openai", "ollama"];

export function createAiProvider(
  aiConfig: FoxbridgeConfig["ai"],
): AiProviderConfig {
  const { provider, api_key, model, base_url } = aiConfig;

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  return {
    provider,
    model: model ?? DEFAULT_MODELS[provider] ?? "unknown",
    apiKey: api_key,
    baseUrl: base_url,
  };
}
