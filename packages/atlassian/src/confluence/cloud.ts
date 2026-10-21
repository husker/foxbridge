import type { AtlassianFetch } from "../types.js";
import { adfToText, textToAdf } from "../adf.js";
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

export class ConfluenceCloudClient implements ConfluenceClient {
  constructor(private readonly fetch: AtlassianFetch) {}

  async search(cql: string, maxResults = 25): Promise<ConfluenceSearchResult> {
    const params = new URLSearchParams({ cql, limit: String(maxResults) });
    const res = await this.fetch(`/wiki/rest/api/search?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to search Confluence`);
    }
    const data = await res.json();
    return {
      results: (data.results ?? []).map((r: Record<string, unknown>) =>
        this.normalizeSearchResult(r),
      ),
      total: data.totalSize ?? data.size ?? 0,
      maxResults: data.limit ?? maxResults,
      startAt: data.start ?? 0,
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}?expand=body.storage,version,space`);
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
    const res = await this.fetch("/wiki/rest/api/content", {
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}`, {
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to delete page ${pageId}`);
    }
  }

  async listSpaces(maxResults = 25): Promise<ConfluenceSpace[]> {
    const res = await this.fetch(`/wiki/rest/api/space?limit=${maxResults}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list spaces`);
    }
    const data = await res.json();
    return (data.results ?? []).map((s: Record<string, unknown>) => this.normalizeSpace(s));
  }

  async listComments(pageId: string): Promise<ConfluenceComment[]> {
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/child/comment?expand=body.storage`);
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/child/comment`, {
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/label`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list labels for page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((l: Record<string, unknown>) => this.normalizeLabel(l));
  }

  async addLabel(pageId: string, label: string): Promise<void> {
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/label`, {
      method: "POST",
      body: JSON.stringify([{ prefix: "global", name: label }]),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add label to page ${pageId}`);
    }
  }

  async removeLabel(pageId: string, label: string): Promise<void> {
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/label/${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to remove label from page ${pageId}`);
    }
  }

  async listAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/child/attachment`);
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/child/attachment`, {
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
    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/property/${key}`);
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

    const res = await this.fetch(`/wiki/rest/api/content/${pageId}/property/${key}`, {
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

  async addInlineComment(pageId: string, body: string, selectionText: string): Promise<ConfluenceComment> {
    const payload = {
      body: {
        representation: "storage",
        value: body,
      },
      inlineCommentProperties: {
        textSelection: selectionText,
      },
    };
    const res = await this.fetch(`/wiki/api/v2/pages/${pageId}/inline-comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to add inline comment to page ${pageId}`);
    }
    const data = await res.json();
    return this.normalizeV2Comment(data);
  }

  async getInlineComments(pageId: string): Promise<ConfluenceComment[]> {
    const res = await this.fetch(`/wiki/api/v2/pages/${pageId}/inline-comments`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list inline comments for page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((c: Record<string, unknown>) => this.normalizeV2Comment(c));
  }

  async getPageDescendants(pageId: string, maxResults = 25): Promise<ConfluencePage[]> {
    const res = await this.fetch(`/wiki/api/v2/pages/${pageId}/children?limit=${maxResults}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to get children of page ${pageId}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((p: Record<string, unknown>) => this.normalizeV2Page(p));
  }

  async getSpacePages(spaceKey: string, maxResults = 25, title?: string): Promise<ConfluencePage[]> {
    // Cloud v2 API needs spaceId; resolve via listSpaces or getSpace
    const spacesRes = await this.fetch(`/wiki/rest/api/space?spaceKey=${encodeURIComponent(spaceKey)}`);
    if (!spacesRes.ok) {
      await throwAtlassianError(spacesRes, `Failed to resolve space ${spaceKey}`);
    }
    const spacesData = await spacesRes.json();
    const space = spacesData.results?.[0];
    if (!space) {
      throw new Error(`Space not found: ${spaceKey}`);
    }
    const spaceId = space.id;

    const params = new URLSearchParams({ "space-id": String(spaceId), limit: String(maxResults) });
    if (title) params.set("title", title);
    const res = await this.fetch(`/wiki/api/v2/pages?${params}`);
    if (!res.ok) {
      await throwAtlassianError(res, `Failed to list pages in space ${spaceKey}`);
    }
    const data = await res.json();
    return (data.results ?? []).map((p: Record<string, unknown>) => this.normalizeV2Page(p));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeV2Comment(raw: any): ConfluenceComment {
    return {
      id: raw.id ?? "",
      body: raw.body?.storage?.value ?? raw.body?.value ?? "",
      author: raw.version?.authorId ?? "",
      created: raw.version?.createdAt ?? raw.createdAt ?? "",
      updated: raw.version?.createdAt ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeV2Page(raw: any): ConfluencePage {
    return {
      id: raw.id ?? "",
      title: raw.title ?? "",
      spaceKey: raw.spaceId ?? "",
      body: raw.body?.storage?.value ?? "",
      version: raw.version?.number ?? 1,
      status: raw.status ?? "",
      created: raw.createdAt ?? "",
      updated: raw.version?.createdAt ?? "",
      authorId: raw.version?.authorId ?? raw.authorId ?? "",
    };
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
      authorId: raw.version?.by?.accountId ?? raw.version?.by?.displayName ?? "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeSearchResult(raw: any): ConfluencePage {
    // Search results have content nested under `content`
    const content = raw.content ?? raw;
    return this.normalizePage(content);
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
      author: raw.history?.createdBy?.accountId ?? raw.history?.createdBy?.displayName ?? "",
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
