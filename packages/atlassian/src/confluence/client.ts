import type { AtlassianPlatform } from "@foxbridge/config";
import type { AtlassianFetch } from "../types.js";
import type { ConfluenceClient } from "./types.js";
import { ConfluenceDataCenterClient } from "./datacenter.js";
import { ConfluenceCloudClient } from "./cloud.js";

export function createConfluenceClient(fetch: AtlassianFetch, platform: AtlassianPlatform): ConfluenceClient {
  if (platform === "cloud") return new ConfluenceCloudClient(fetch);
  return new ConfluenceDataCenterClient(fetch);
}
