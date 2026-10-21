import type { AtlassianFetch } from "../types.js";
import { throwAtlassianError } from "../errors.js";
import type {
  ConfluenceClient,
  ConfluencePage,
  ConfluenceSpace,
  ConfluenceSearchResult,
  ConfluenceComment,
  ConfluenceLabel,
  ConfluenceAttachment,
  ConfluenceContentProperty,
} from "./types.js";

export class ConfluenceDataCenterClient implements ConfluenceClient {
  constructor(private readonly fetch: AtlassianFetch) {}

  async search(cql: string, maxResults = 25): Promise<ConfluenceSearchResult> {
    const params = new URLSearchParams({ cql, limit: String(maxResults) });
    const res = await this.fetch(`/rest/api/content/search?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search Confluence`);
    }
    const data = await res.json();
    return {
      results: (data.results ?? []).map((r: Record<string, unknown>) => this.normalizePage(r)),
      total: data.totalSize ?? data.size ?? 0,
      maxResults: data.limit ?? maxResults,
      startAt: data.start ?? 0,
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const res = await this.fetch(`/rest/api/content/${pageId}?expand=body.storage,version,space`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get page ${pageId}`);
    }
    const data = await res.json();
    return this.normalizePage(data);
  }

  async createPage(spaceKey: string, title: string, body: string, parentId?: string): Promise<ConfluencePage> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      type: "page",
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: body,
          representation: "storage",
        },
      },
    };
    if (parentId) {
      payload.ancestors = [{ id: parentId }];
    }
    const res = await this.fetch("/rest/api/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to create page`);
    }
    const data = await res.json();
    return this.normalizePage(data);
  }

  async updatePage(pageId: string, title: string, body: string, version: number): Promise<ConfluencePage> {
    const payload = {
      type: "page",
      title,
      version: { number: version },
      body: {
        storage: {
          value: body,
          representation: "storage",
        },
      },
    };
    const res = await this.fetch(`/rest/api/content/${pageId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to update page ${pageId}`);
    }
    const data = await res.json();
    return this.normalizePage(data);
  }

  async deletePage(pageId: string): Promise<void> {
    const res = await this.fetch(`/rest/api/content/${pageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete page ${pageId}`);
    }
  }

  async listSpaces(maxResults = 25): Promise<ConfluenceSpace[]> {
    const res = await this.fetch(`/rest/api/space?limit=${maxResults}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list spaces`);
    }
    const data = await res.json();
    return (data.results ?? []).map((s: Record<string, unknown>) => this.normalizeSpace(s));
  }

  async listComments(pageId: string): Promise<ConfluenceComment[]> {
    const res = await this.fetch(`/rest/api/content/${pageId}/child/comment?expand=body.storage`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list comments for page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((c: Record<string, unknown>) => this.normalizeComment(c));
  }

  async addComment(pageId: string, body: string): Promise<ConfluenceComment> {
    const payload = {
      type: "comment",
      container: { id: pageId, type: "page" },
      body: {
        storage: {
          value: body,
          representation: "storage",
        },
      },
    };
    const res = await this.fetch(`/rest/api/content/${pageId}/child/comment`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add comment to page ${pageId}`);
    }
    const data = await res.json();
    return this.normalizeComment(data);
  }

  async listLabels(pageId: string): Promise<ConfluenceLabel[]> {
    const res = await this.fetch(`/rest/api/content/${pageId}/label`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list labels for page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((l: Record<string, unknown>) => this.normalizeLabel(l));
  }

  async addLabel(pageId: string, label: string): Promise<void> {
    const res = await this.fetch(`/rest/api/content/${pageId}/label`, {
      method: "POST",
      body: JSON.stringify([{ prefix: "global", name: label }]),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add label to page ${pageId}`);
    }
  }

  async removeLabel(pageId: string, label: string): Promise<void> {
    const res = await this.fetch(`/rest/api/content/${pageId}/label/${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to remove label from page ${pageId}`);
    }
  }

  async listAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    const res = await this.fetch(`/rest/api/content/${pageId}/child/attachment`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list attachments for page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((a: Record<string, unknown>) => this.normalizeAttachment(a));
  }

  async downloadAttachment(downloadUrl: string): Promise<{ filename: string; content: Buffer }> {
    const res = await this.fetch(downloadUrl);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to download attachment`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const rawName = downloadUrl.split("/").pop() ?? "attachment";
    const filename = rawName.split("?")[0];
    return { filename, content: buffer };
  }

  async addAttachment(pageId: string, filename: string, content: Buffer): Promise<ConfluenceAttachment> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(content)]);
    formData.append("file", blob, filename);
    const res = await this.fetch(`/rest/api/content/${pageId}/child/attachment`, {
      method: "POST",
      body: formData,
      headers: { "X-Atlassian-Token": "no-check" },
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add attachment to page ${pageId}`);
    }
    const data = await res.json();
    const result = data.results?.[0] ?? data;
    return this.normalizeAttachment(result);
  }

  async getContentProperty(pageId: string, key: string): Promise<ConfluenceContentProperty | null> {
    const res = await this.fetch(`/rest/api/content/${pageId}/property/${key}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get content property ${key} for page ${pageId}`);
    }
    const data = await res.json();
    return {
      key: data.key,
      value: data.value,
      version: data.version?.number ?? 1,
    };
  }

  async setContentProperty(pageId: string, key: string, value: unknown): Promise<void> {
    // Try to get existing property to determine version
    const existing = await this.getContentProperty(pageId, key);
    const version = existing ? existing.version + 1 : 1;

    const res = await this.fetch(`/rest/api/content/${pageId}/property/${key}`, {
      method: "PUT",
      body: JSON.stringify({
        key,
        value,
        version: { number: version },
      }),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to set content property ${key} for page ${pageId}`);
    }
  }

  async addInlineComment(_pageId: string, _body: string, _selectionText: string): Promise<ConfluenceComment> {
    throw new Error("Inline comments are not supported on Atlassian Data Center");
  }

  async getInlineComments(_pageId: string): Promise<ConfluenceComment[]> {
    // Inline comments are not supported on DC; return empty array
    return [];
  }

  async getPageDescendants(pageId: string, maxResults = 25): Promise<ConfluencePage[]> {
    const res = await this.fetch(`/rest/api/content/${pageId}/child/page?limit=${maxResults}&expand=body.storage,version,space`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get children of page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((p: Record<string, unknown>) => this.normalizePage(p));
  }

  async getSpacePages(spaceKey: string, maxResults = 25, title?: string): Promise<ConfluencePage[]> {
    const params = new URLSearchParams({
      spaceKey,
      type: "page",
      limit: String(maxResults),
    });
    if (title) params.set("title", title);
    params.set("expand", "body.storage,version,space");
    const res = await this.fetch(`/rest/api/content?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list pages in space ${spaceKey}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((p: Record<string, unknown>) => this.normalizePage(p));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizePage(raw: any): ConfluencePage {
    return {
      id: raw.id ?? "",
      title: raw.title ?? "",
      spaceKey: raw.space?.key ?? "",
      body: raw.body?.storage?.value ?? "",
      version: raw.version?.number ?? 1,
      status: raw.status ?? "",
      created: raw.history?.createdDate ?? raw.version?.when ?? "",
      updated: raw.version?.when ?? "",
      authorId: raw.version?.by?.username ?? raw.version?.by?.displayName ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeSpace(raw: any): ConfluenceSpace {
    return {
      id: raw.id ?? "",
      key: raw.key ?? "",
      name: raw.name ?? "",
      description: raw.description?.plain?.value ?? "",
      type: raw.type ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeComment(raw: any): ConfluenceComment {
    return {
      id: raw.id ?? "",
      body: raw.body?.storage?.value ?? "",
      author: raw.history?.createdBy?.username ?? raw.history?.createdBy?.displayName ?? "",
      created: raw.history?.createdDate ?? "",
      updated: raw.version?.when ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeLabel(raw: any): ConfluenceLabel {
    return {
      id: raw.id ?? "",
      name: raw.name ?? "",
      prefix: raw.prefix ?? "global",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeAttachment(raw: any): ConfluenceAttachment {
    return {
      id: raw.id ?? "",
      title: raw.title ?? "",
      filename: raw.title ?? "",
      mediaType: raw.metadata?.mediaType ?? raw.extensions?.mediaType ?? "",
      fileSize: raw.extensions?.fileSize ?? 0,
      downloadUrl: raw._links?.download ?? "",
      created: raw.history?.createdDate ?? raw.version?.when ?? "",
    };
  }
}
