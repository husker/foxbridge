import type { FeatureToggle } from "@foxbridge/config";

export type Product = "jira" | "confluence" | "bitbucket" | "assets";
export type Operation = "read" | "write";

export function shouldRegisterTool(
  product: Product,
  operation: Operation,
  features: Record<Product, FeatureToggle>,
): boolean {
  return features[product][operation];
}
