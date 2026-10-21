import { z } from "zod";

const featureToggleSchema = z.object({
  read: z.boolean(),
  write: z.boolean(),
});

export const configSchema = z.object({
  atlassian: z.object({
    platform: z.enum(["cloud", "datacenter"]),
    base_url: z.string().url(),
    auth_method: z.enum(["basic", "pat"]).default("pat"),
    jira_url: z.string().url().optional(),
    confluence_url: z.string().url().optional(),
    bitbucket_url: z.string().url().optional(),
    browse_url: z.string().url().optional(),
  }),
  ai: z.object({
    provider: z.enum(["anthropic", "openai", "azure_openai", "ollama"]),
    api_key: z.string().optional(),
    model: z.string().optional(),
    base_url: z.string().url().optional(),
  }),
  features: z.object({
    jira: featureToggleSchema,
    confluence: featureToggleSchema,
    bitbucket: featureToggleSchema,
    assets: featureToggleSchema.default({ read: false, write: false }),
  }),
  oauth: z.object({
    client_id: z.string(),
    client_secret: z.string(),
    callback_url: z.string().url(),
  }).optional(),
  scrub_pii: z.boolean().default(false),
  dev_mode: z.boolean().default(false),
  port_chat: z.number().int().min(1).max(65535).default(3000),
  port_mcp: z.number().int().min(1).max(65535).default(3001),
  log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type FoxbridgeConfig = z.infer<typeof configSchema>;
