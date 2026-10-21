import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { ConfluenceCloudClient } from "./cloud.js";

function mockFetch(responseBody: unknown, status = 200): AtlassianFetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(responseBody),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  }) as unknown as AtlassianFetch;
}

const rawPage = {
  id: "12345",
  title: "Cloud Page",
  space: { key: "CLOUD" },
  body: { storage: { value: "<p>Cloud content</p>" } },
  version: { number: 2, when: "2025-02-02T00:00:00.000Z", by: { accountId: "abc123", displayName: "Jane Doe" } },
  status: "current",
  history: { createdDate: "2025-02-01T00:00:00.000Z" },
};

describe("ConfluenceCloudClient", () => {
  let fetchMock: AtlassianFetch;
  let client: ConfluenceCloudClient;

  beforeEach(() => {
    fetchMock = mockFetch({});
    client = new ConfluenceCloudClient(fetchMock);
  });

  describe("search", () => {
    it("uses /wiki/rest/api/search with CQL", async () => {
      const fetch = mockFetch({
        results: [{ content: rawPage }],
        totalSize: 1,
        limit: 25,
        start: 0,
      });
      client = new ConfluenceCloudClient(fetch);

      const result = await client.search("type=page");

      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("/wiki/rest/api/search?");
      expect(url).toContain("cql=type%3Dpage");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("12345");
      expect(result.results[0].title).toBe("Cloud Page");
      expect(result.total).toBe(1);
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 500);
      client = new ConfluenceCloudClient(fetch);

      await expect(client.search("invalid")).rejects.toThrow("Failed to search Confluence: 500");
    });
  });

  describe("getPage", () => {
    it("uses /wiki/rest/api/content/{id} with expand params", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceCloudClient(fetch);

      const page = await client.getPage("12345");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345?expand=body.storage,version,space");
      expect(page.id).toBe("12345");
      expect(page.title).toBe("Cloud Page");
      expect(page.spaceKey).toBe("CLOUD");
      expect(page.body).toBe("<p>Cloud content</p>");
      expect(page.version).toBe(2);
      expect(page.authorId).toBe("abc123");
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 404);
      client = new ConfluenceCloudClient(fetch);

      await expect(client.getPage("99999")).rejects.toThrow("Failed to get page 99999: 404");
    });
  });

  describe("createPage", () => {
    it("POSTs to /wiki/rest/api/content", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceCloudClient(fetch);

      const page = await client.createPage("CLOUD", "Cloud Page", "<p>Cloud content</p>");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content", {
        method: "POST",
        body: JSON.stringify({
          type: "page",
          title: "Cloud Page",
          space: { key: "CLOUD" },
          body: {
            storage: {
              value: "<p>Cloud content</p>",
              representation: "storage",
            },
          },
        }),
      });
      expect(page.id).toBe("12345");
    });
  });

  describe("updatePage", () => {
    it("PUTs to /wiki/rest/api/content/{id}", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceCloudClient(fetch);

      await client.updatePage("12345", "Updated", "<p>Updated</p>", 3);

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345", {
        method: "PUT",
        body: JSON.stringify({
          type: "page",
          title: "Updated",
          version: { number: 3 },
          body: {
            storage: {
              value: "<p>Updated</p>",
              representation: "storage",
            },
          },
        }),
      });
    });
  });

  describe("deletePage", () => {
    it("DELETEs /wiki/rest/api/content/{id}", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceCloudClient(fetch);

      await client.deletePage("12345");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345", {
        method: "DELETE",
      });
    });
  });

  describe("listSpaces", () => {
    it("uses /wiki/rest/api/space", async () => {
      const fetch = mockFetch({
        results: [
          { id: "1", key: "CLOUD", name: "Cloud Space", type: "global", description: { plain: { value: "A cloud space" } } },
        ],
      });
      client = new ConfluenceCloudClient(fetch);

      const spaces = await client.listSpaces();

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/space?limit=25");
      expect(spaces).toHaveLength(1);
      expect(spaces[0].key).toBe("CLOUD");
      expect(spaces[0].description).toBe("A cloud space");
    });
  });

  describe("listComments", () => {
    it("calls /wiki/rest/api/content/{id}/child/comment", async () => {
      const fetch = mockFetch({
        results: [
          {
            id: "c1",
            body: { storage: { value: "<p>Cloud comment</p>" } },
            history: { createdDate: "2025-02-01T00:00:00.000Z", createdBy: { accountId: "abc123" } },
            version: { when: "2025-02-01T00:00:00.000Z" },
          },
        ],
      });
      client = new ConfluenceCloudClient(fetch);

      const comments = await client.listComments("12345");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/child/comment?expand=body.storage");
      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("abc123");
    });
  });

  describe("addComment", () => {
    it("POSTs to /wiki/rest/api/content/{id}/child/comment", async () => {
      const fetch = mockFetch({
        id: "c1",
        body: { storage: { value: "<p>Cloud comment</p>" } },
        history: { createdDate: "2025-02-01T00:00:00.000Z", createdBy: { accountId: "abc123" } },
        version: { when: "2025-02-01T00:00:00.000Z" },
      });
      client = new ConfluenceCloudClient(fetch);

      const comment = await client.addComment("12345", "<p>Cloud comment</p>");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/child/comment", {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          container: { id: "12345", type: "page" },
          body: {
            storage: {
              value: "<p>Cloud comment</p>",
              representation: "storage",
            },
          },
        }),
      });
      expect(comment.id).toBe("c1");
      expect(comment.body).toBe("<p>Cloud comment</p>");
      expect(comment.author).toBe("abc123");
    });
  });

  describe("listLabels", () => {
    it("uses /wiki prefix for labels endpoint", async () => {
      const fetch = mockFetch({
        results: [
          { id: "l1", name: "cloud-label", prefix: "global" },
        ],
      });
      client = new ConfluenceCloudClient(fetch);

      const labels = await client.listLabels("12345");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/label");
      expect(labels).toHaveLength(1);
      expect(labels[0].name).toBe("cloud-label");
    });
  });

  describe("addLabel", () => {
    it("POSTs to /wiki prefix endpoint", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceCloudClient(fetch);

      await client.addLabel("12345", "cloud-label");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/label", {
        method: "POST",
        body: JSON.stringify([{ prefix: "global", name: "cloud-label" }]),
      });
    });
  });

  describe("removeLabel", () => {
    it("DELETEs with /wiki prefix", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceCloudClient(fetch);

      await client.removeLabel("12345", "cloud-label");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/label/cloud-label", {
        method: "DELETE",
      });
    });
  });

  describe("listAttachments", () => {
    it("uses /wiki prefix for attachments", async () => {
      const fetch = mockFetch({
        results: [
          {
            id: "a1",
            title: "report.pdf",
            extensions: { mediaType: "application/pdf", fileSize: 2048 },
            _links: { download: "/wiki/download/attachments/12345/report.pdf" },
            version: { when: "2025-02-01T00:00:00.000Z" },
          },
        ],
      });
      client = new ConfluenceCloudClient(fetch);

      const attachments = await client.listAttachments("12345");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/child/attachment");
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe("report.pdf");
    });
  });

  describe("downloadAttachment", () => {
    it("strips query params from filename", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      }) as unknown as AtlassianFetch;
      client = new ConfluenceCloudClient(fetch);

      const result = await client.downloadAttachment("/wiki/download/attachments/12345/report.pdf?version=1");

      expect(result.filename).toBe("report.pdf");
      expect(result.content).toBeInstanceOf(Buffer);
    });
  });

  describe("addAttachment", () => {
    it("POSTs to /wiki prefixed endpoint with X-Atlassian-Token header", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({
          results: [{
            id: "a2",
            title: "upload.txt",
            extensions: { mediaType: "text/plain", fileSize: 5 },
            _links: { download: "/wiki/download/attachments/12345/upload.txt" },
            version: { when: "2025-02-01T00:00:00.000Z" },
          }],
        }),
      }) as unknown as AtlassianFetch;
      client = new ConfluenceCloudClient(fetch);

      const attachment = await client.addAttachment("12345", "upload.txt", Buffer.from("hello"));

      expect(fetch).toHaveBeenCalledWith(
        "/wiki/rest/api/content/12345/child/attachment",
        expect.objectContaining({
          method: "POST",
          headers: { "X-Atlassian-Token": "no-check" },
        }),
      );
      expect(attachment.filename).toBe("upload.txt");
    });
  });

  describe("getContentProperty", () => {
    it("uses /wiki prefix and returns property", async () => {
      const fetch = mockFetch({
        key: "theme",
        value: { dark: true },
        version: { number: 1 },
      });
      client = new ConfluenceCloudClient(fetch);

      const prop = await client.getContentProperty("12345", "theme");

      expect(fetch).toHaveBeenCalledWith("/wiki/rest/api/content/12345/property/theme");
      expect(prop).not.toBeNull();
      expect(prop!.key).toBe("theme");
      expect(prop!.value).toEqual({ dark: true });
    });

    it("returns null on 404", async () => {
      const fetch = mockFetch({}, 404);
      client = new ConfluenceCloudClient(fetch);

      const prop = await client.getContentProperty("12345", "missing");

      expect(prop).toBeNull();
    });
  });

  describe("setContentProperty", () => {
    it("PUTs with /wiki prefix and correct version", async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({ key: "theme", value: { old: true }, version: { number: 2 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({}),
        }) as unknown as AtlassianFetch;
      client = new ConfluenceCloudClient(fetchFn);

      await client.setContentProperty("12345", "theme", { dark: false });

      const putCall = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(putCall[0]).toBe("/wiki/rest/api/content/12345/property/theme");
      expect(putCall[1].method).toBe("PUT");
      const putBody = JSON.parse(putCall[1].body);
      expect(putBody.version.number).toBe(3);
    });
  });
});
