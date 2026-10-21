export interface UserCredentials {
  user: string;    // email (Cloud) or username (DC)
  token: string;   // API token (Cloud) or PAT (DC)
}

export interface AtlassianFetch {
  (path: string, init?: RequestInit): Promise<Response>;
}

export interface PagedResult<T> {
  values: T[];
  total: number;
  isLastPage: boolean;
  nextPageStart?: number;
}
