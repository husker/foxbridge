import type { AtlassianPlatform } from "@foxbridge/config";
import type { AtlassianFetch } from "../types.js";
import type { JiraClient } from "./types.js";
import { JiraDataCenterClient } from "./datacenter.js";
import { JiraCloudClient } from "./cloud.js";

export function createJiraClient(fetch: AtlassianFetch, platform: AtlassianPlatform): JiraClient {
  if (platform === "cloud") return new JiraCloudClient(fetch);
  return new JiraDataCenterClient(fetch);
}
