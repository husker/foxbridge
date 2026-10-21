import { describe, it, expect } from "vitest";
import { shouldRegisterTool, type Product, type Operation } from "./feature-toggle.js";
import type { FeatureToggle } from "@foxbridge/config";

function makeFeatures(overrides?: Partial<Record<Product, Partial<FeatureToggle>>>): Record<Product, FeatureToggle> {
  const defaults: Record<Product, FeatureToggle> = {
    jira: { read: true, write: true },
    confluence: { read: true, write: true },
    bitbucket: { read: true, write: true },
    assets: { read: false, write: false },
  };
  if (!overrides) return defaults;
  for (const [product, toggle] of Object.entries(overrides) as [Product, Partial<FeatureToggle>][]) {
    defaults[product] = { ...defaults[product], ...toggle };
  }
  return defaults;
}

describe("shouldRegisterTool", () => {
  it("allows read tool when read is enabled", () => {
    const features = makeFeatures();
    expect(shouldRegisterTool("jira", "read", features)).toBe(true);
  });

  it("allows write tool when write is enabled", () => {
    const features = makeFeatures();
    expect(shouldRegisterTool("confluence", "write", features)).toBe(true);
  });

  it("blocks read tool when read is disabled", () => {
    const features = makeFeatures({ jira: { read: false } });
    expect(shouldRegisterTool("jira", "read", features)).toBe(false);
  });

  it("blocks write tool when write is disabled", () => {
    const features = makeFeatures({ bitbucket: { write: false } });
    expect(shouldRegisterTool("bitbucket", "write", features)).toBe(false);
  });

  it("allows read even when write is disabled", () => {
    const features = makeFeatures({ confluence: { write: false } });
    expect(shouldRegisterTool("confluence", "read", features)).toBe(true);
  });

  it("blocks write even when read is enabled", () => {
    const features = makeFeatures({ jira: { write: false } });
    expect(shouldRegisterTool("jira", "write", features)).toBe(false);
  });

  it("handles all products independently", () => {
    const features = makeFeatures({
      jira: { read: true, write: false },
      confluence: { read: false, write: true },
      bitbucket: { read: false, write: false },
    });
    expect(shouldRegisterTool("jira", "read", features)).toBe(true);
    expect(shouldRegisterTool("jira", "write", features)).toBe(false);
    expect(shouldRegisterTool("confluence", "read", features)).toBe(false);
    expect(shouldRegisterTool("confluence", "write", features)).toBe(true);
    expect(shouldRegisterTool("bitbucket", "read", features)).toBe(false);
    expect(shouldRegisterTool("bitbucket", "write", features)).toBe(false);
  });
});
