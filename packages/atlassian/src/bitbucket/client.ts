import type { AtlassianPlatform } from "@foxbridge/config";
import type { AtlassianFetch } from "../types.js";
import type { BitbucketClient } from "./types.js";
import { BitbucketDataCenterClient } from "./datacenter.js";
import { BitbucketCloudClient } from "./cloud.js";

export function createBitbucketClient(fetch: AtlassianFetch, platform: AtlassianPlatform): BitbucketClient {
  if (platform === "cloud") return new BitbucketCloudClient(fetch);
  return new BitbucketDataCenterClient(fetch);
}
