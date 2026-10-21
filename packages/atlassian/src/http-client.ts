import type { AtlassianPlatform } from "@foxbridge/config";
import type { UserCredentials, AtlassianFetch } from "./types.js";

export type AuthMethod = "basic" | "pat";

export interface FetchOptions {
  authMode?: "basic" | "pat" | "oauth";
  onTokenRefresh?: () => Promise<string | null>;
}

export function createAtlassianFetch(
  baseUrl: string,
  platform: AtlassianPlatform,
  credentials: UserCredentials,
  authMethod?: AuthMethod,
  options?: FetchOptions,
): AtlassianFetch {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const isOAuth = options?.authMode === "oauth";
  // Cloud uses Basic auth (email:api_token), DC uses Basic or Bearer (PAT)
  const useBasic = !isOAuth && (platform === "cloud" || authMethod === "basic");

  let currentToken = credentials.token;

  return async (path: string, init?: RequestInit): Promise<Response> => {
    const url = `${normalizedBase}${path}`;
    const headers = new Headers(init?.headers);

    if (isOAuth) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    } else if (useBasic) {
      const encoded = Buffer.from(`${credentials.user}:${currentToken}`).toString("base64");
      headers.set("Authorization", `Basic ${encoded}`);
    } else {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }

    // Don't set Content-Type for FormData — let fetch set the multipart boundary
    if (!(init?.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    let response = await fetch(url, { ...init, headers });

    // Auto-refresh on 401 for OAuth sessions
    if (response.status === 401 && isOAuth && options?.onTokenRefresh) {
      const newToken = await options.onTokenRefresh();
      if (newToken) {
        currentToken = newToken;
        headers.set("Authorization", `Bearer ${newToken}`);
        response = await fetch(url, { ...init, headers });
      }
    }

    return response;
  };
}
