import { describe, it, expect } from "vitest";
import { createAiProvider } from "./ai-provider.js";
import type { FoxbridgeConfig } from "@foxbridge/config";

describe("createAiProvider", () => {
  it("creates anthropic provider with default model", () => {
    const config: FoxbridgeConfig["ai"] = { provider: "anthropic", api_key: "sk-ant-123" };
    const result = createAiProvider(config);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.apiKey).toBe("sk-ant-123");
    expect(result.baseUrl).toBeUndefined();
  });

  it("creates openai provider with default model", () => {
    const config: FoxbridgeConfig["ai"] = { provider: "openai", api_key: "sk-openai" };
    const result = createAiProvider(config);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o");
  });

  it("creates azure_openai provider with default model", () => {
    const config: FoxbridgeConfig["ai"] = {
      provider: "azure_openai",
      api_key: "az-key",
      base_url: "https://my-resource.openai.azure.com",
    };
    const result = createAiProvider(config);
    expect(result.provider).toBe("azure_openai");
    expect(result.model).toBe("gpt-4o");
    expect(result.baseUrl).toBe("https://my-resource.openai.azure.com");
  });

  it("creates ollama provider with default model", () => {
    const config: FoxbridgeConfig["ai"] = {
      provider: "ollama",
      base_url: "http://localhost:11434",
    };
    const result = createAiProvider(config);
    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("llama3.1");
    expect(result.apiKey).toBeUndefined();
    expect(result.baseUrl).toBe("http://localhost:11434");
  });

  it("uses custom model when specified", () => {
    const config: FoxbridgeConfig["ai"] = {
      provider: "anthropic",
      api_key: "sk-ant-123",
      model: "claude-opus-4-6",
    };
    const result = createAiProvider(config);
    expect(result.model).toBe("claude-opus-4-6");
  });

  it("throws for unsupported provider", () => {
    const config = { provider: "unsupported" as any };
    expect(() => createAiProvider(config)).toThrow("Unsupported AI provider: unsupported");
  });
});
