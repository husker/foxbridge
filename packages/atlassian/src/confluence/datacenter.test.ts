import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AtlassianFetch } from "../types.js";
import { ConfluenceDataCenterClient } from "./datacenter.js";

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
  title: "Test Page",
  space: { key: "DEV" },
  body: { storage: { value: "<p>Hello world</p>" } },
  version: { number: 3, when: "2025-01-02T00:00:00.000Z", by: { username: "jdoe", displayName: "John Doe" } },
  status: "current",
  history: { createdDate: "2025-01-01T00:00:00.000Z" },
};

describe("ConfluenceDataCenterClient", () => {
  let fetchMock: AtlassianFetch;
  let client: ConfluenceDataCenterClient;

  beforeEach(() => {
    fetchMock = mockFetch({});
    client = new ConfluenceDataCenterClient(fetchMock);
  });

  describe("search", () => {
    it("calls /rest/api/content/search with CQL", async () => {
      const fetch = mockFetch({
        results: [rawPage],
        totalSize: 1,
        limit: 25,
        start: 0,
      });
      client = new ConfluenceDataCenterClient(fetch);

      const result = await client.search("type=page AND space=DEV");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/api/content/search?"),
      );
      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("cql=type%3Dpage+AND+space%3DDEV");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("12345");
      expect(result.results[0].title).toBe("Test Page");
      expect(result.results[0].body).toBe("<p>Hello world</p>");
      expect(result.total).toBe(1);
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 500);
      client = new ConfluenceDataCenterClient(fetch);

      await expect(client.search("invalid")).rejects.toThrow("Failed to search Confluence: 500");
    });
  });

  describe("getPage", () => {
    it("calls /rest/api/content/{id} with expand params", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceDataCenterClient(fetch);

      const page = await client.getPage("12345");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345?expand=body.storage,version,space");
      expect(page.id).toBe("12345");
      expect(page.title).toBe("Test Page");
      expect(page.spaceKey).toBe("DEV");
      expect(page.body).toBe("<p>Hello world</p>");
      expect(page.version).toBe(3);
      expect(page.status).toBe("current");
    });

    it("throws on error response", async () => {
      const fetch = mockFetch({}, 404);
      client = new ConfluenceDataCenterClient(fetch);

      await expect(client.getPage("99999")).rejects.toThrow("Failed to get page 99999: 404");
    });
  });

  describe("createPage", () => {
    it("POSTs to /rest/api/content with correct body structure", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceDataCenterClient(fetch);

      const page = await client.createPage("DEV", "Test Page", "<p>Hello world</p>");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content", {
        method: "POST",
        body: JSON.stringify({
          type: "page",
          title: "Test Page",
          space: { key: "DEV" },
          body: {
            storage: {
              value: "<p>Hello world</p>",
              representation: "storage",
            },
          },
        }),
      });
      expect(page.id).toBe("12345");
    });

    it("includes ancestors when parentId is provided", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceDataCenterClient(fetch);

      await client.createPage("DEV", "Child Page", "<p>Child</p>", "99999");

      const callBody = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(callBody.ancestors).toEqual([{ id: "99999" }]);
    });
  });

  describe("updatePage", () => {
    it("PUTs to /rest/api/content/{id} with version number", async () => {
      const fetch = mockFetch(rawPage);
      client = new ConfluenceDataCenterClient(fetch);

      const page = await client.updatePage("12345", "Updated Title", "<p>Updated</p>", 4);

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345", {
        method: "PUT",
        body: JSON.stringify({
          type: "page",
          title: "Updated Title",
          version: { number: 4 },
          body: {
            storage: {
              value: "<p>Updated</p>",
              representation: "storage",
            },
          },
        }),
      });
      expect(page.id).toBe("12345");
    });
  });

  describe("deletePage", () => {
    it("DELETEs /rest/api/content/{id}", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceDataCenterClient(fetch);

      await client.deletePage("12345");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345", {
        method: "DELETE",
      });
    });
  });

  describe("listSpaces", () => {
    it("calls /rest/api/space and returns normalized spaces", async () => {
      const fetch = mockFetch({
        results: [
          { id: "1", key: "DEV", name: "Development", type: "global", description: { plain: { value: "Dev space" } } },
          { id: "2", key: "OPS", name: "Operations", type: "global", description: { plain: { value: "" } } },
        ],
      });
      client = new ConfluenceDataCenterClient(fetch);

      const spaces = await client.listSpaces();

      expect(fetch).toHaveBeenCalledWith("/rest/api/space?limit=25");
      expect(spaces).toHaveLength(2);
      expect(spaces[0].key).toBe("DEV");
      expect(spaces[0].name).toBe("Development");
      expect(spaces[0].description).toBe("Dev space");
      expect(spaces[1].key).toBe("OPS");
    });
  });

  describe("listComments", () => {
    it("calls /rest/api/content/{id}/child/comment", async () => {
      const fetch = mockFetch({
        results: [
          {
            id: "c1",
            body: { storage: { value: "<p>Great page!</p>" } },
            history: { createdDate: "2025-01-01T00:00:00.000Z", createdBy: { username: "jdoe" } },
            version: { when: "2025-01-01T00:00:00.000Z" },
          },
        ],
      });
      client = new ConfluenceDataCenterClient(fetch);

      const comments = await client.listComments("12345");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/child/comment?expand=body.storage");
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe("c1");
      expect(comments[0].body).toBe("<p>Great page!</p>");
      expect(comments[0].author).toBe("jdoe");
    });
  });

  describe("addComment", () => {
    it("POSTs to correct endpoint with storage body", async () => {
      const fetch = mockFetch({
        id: "c2",
        body: { storage: { value: "<p>New comment</p>" } },
        history: { createdDate: "2025-01-02T00:00:00.000Z", createdBy: { username: "jsmith" } },
        version: { when: "2025-01-02T00:00:00.000Z" },
      });
      client = new ConfluenceDataCenterClient(fetch);

      const comment = await client.addComment("12345", "<p>New comment</p>");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/child/comment", {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          container: { id: "12345", type: "page" },
          body: {
            storage: {
              value: "<p>New comment</p>",
              representation: "storage",
            },
          },
        }),
      });
      expect(comment.id).toBe("c2");
      expect(comment.body).toBe("<p>New comment</p>");
    });
  });

  describe("listLabels", () => {
    it("returns labels array", async () => {
      const fetch = mockFetch({
        results: [
          { id: "l1", name: "important", prefix: "global" },
          { id: "l2", name: "review", prefix: "global" },
        ],
      });
      client = new ConfluenceDataCenterClient(fetch);

      const labels = await client.listLabels("12345");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/label");
      expect(labels).toHaveLength(2);
      expect(labels[0].name).toBe("important");
      expect(labels[1].name).toBe("review");
    });
  });

  describe("addLabel", () => {
    it("POSTs label with global prefix", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceDataCenterClient(fetch);

      await client.addLabel("12345", "important");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/label", {
        method: "POST",
        body: JSON.stringify([{ prefix: "global", name: "important" }]),
      });
    });
  });

  describe("removeLabel", () => {
    it("DELETEs label by name", async () => {
      const fetch = mockFetch({});
      client = new ConfluenceDataCenterClient(fetch);

      await client.removeLabel("12345", "important");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/label/important", {
        method: "DELETE",
      });
    });
  });

  describe("listAttachments", () => {
    it("calls child/attachment endpoint", async () => {
      const fetch = mockFetch({
        results: [
          {
            id: "a1",
            title: "doc.pdf",
            extensions: { mediaType: "application/pdf", fileSize: 1024 },
            _links: { download: "/download/attachments/12345/doc.pdf" },
            version: { when: "2025-01-01T00:00:00.000Z" },
          },
        ],
      });
      client = new ConfluenceDataCenterClient(fetch);

      const attachments = await client.listAttachments("12345");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/child/attachment");
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe("doc.pdf");
      expect(attachments[0].mediaType).toBe("application/pdf");
      expect(attachments[0].fileSize).toBe(1024);
    });
  });

  describe("downloadAttachment", () => {
    it("fetches from download URL and strips query params from filename", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      }) as unknown as AtlassianFetch;
      client = new ConfluenceDataCenterClient(fetch);

      const result = await client.downloadAttachment("/download/attachments/12345/doc.pdf?version=2");

      expect(fetch).toHaveBeenCalledWith("/download/attachments/12345/doc.pdf?version=2");
      expect(result.filename).toBe("doc.pdf");
      expect(result.content).toBeInstanceOf(Buffer);
    });
  });

  describe("addAttachment", () => {
    it("POSTs multipart with X-Atlassian-Token header", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({
          results: [{
            id: "a2",
            title: "upload.txt",
            extensions: { mediaType: "text/plain", fileSize: 5 },
            _links: { download: "/download/attachments/12345/upload.txt" },
            version: { when: "2025-01-01T00:00:00.000Z" },
          }],
        }),
      }) as unknown as AtlassianFetch;
      client = new ConfluenceDataCenterClient(fetch);

      const attachment = await client.addAttachment("12345", "upload.txt", Buffer.from("hello"));

      expect(fetch).toHaveBeenCalledWith(
        "/rest/api/content/12345/child/attachment",
        expect.objectContaining({
          method: "POST",
          headers: { "X-Atlassian-Token": "no-check" },
        }),
      );
      expect(attachment.filename).toBe("upload.txt");
    });
  });

  describe("getContentProperty", () => {
    it("returns property when found", async () => {
      const fetch = mockFetch({
        key: "my-prop",
        value: { color: "blue" },
        version: { number: 2 },
      });
      client = new ConfluenceDataCenterClient(fetch);

      const prop = await client.getContentProperty("12345", "my-prop");

      expect(fetch).toHaveBeenCalledWith("/rest/api/content/12345/property/my-prop");
      expect(prop).not.toBeNull();
      expect(prop!.key).toBe("my-prop");
      expect(prop!.value).toEqual({ color: "blue" });
      expect(prop!.version).toBe(2);
    });

    it("returns null when not found (404)", async () => {
      const fetch = mockFetch({}, 404);
      client = new ConfluenceDataCenterClient(fetch);

      const prop = await client.getContentProperty("12345", "missing");

      expect(prop).toBeNull();
    });
  });

  describe("setContentProperty", () => {
    it("PUTs property with incremented version when existing", async () => {
      // First call for getContentProperty returns existing, second for PUT
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({ key: "my-prop", value: { old: true }, version: { number: 3 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({}),
        }) as unknown as AtlassianFetch;
      client = new ConfluenceDataCenterClient(fetchFn);

      await client.setContentProperty("12345", "my-prop", { new: true });

      expect(fetchFn).toHaveBeenCalledTimes(2);
      const putCall = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(putCall[0]).toBe("/rest/api/content/12345/property/my-prop");
      expect(putCall[1].method).toBe("PUT");
      const putBody = JSON.parse(putCall[1].body);
      expect(putBody.version.number).toBe(4);
      expect(putBody.value).toEqual({ new: true });
    });

    it("PUTs property with version 1 when not existing", async () => {
      // First call returns 404, second for PUT
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({}),
        }) as unknown as AtlassianFetch;
      client = new ConfluenceDataCenterClient(fetchFn);

      await client.setContentProperty("12345", "new-prop", "hello");

      const putCall = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
      const putBody = JSON.parse(putCall[1].body);
      expect(putBody.version.number).toBe(1);
    });
  });
});
