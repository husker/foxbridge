import { describe, it, expect } from "vitest";
import { throwAtlassianError } from "./errors.js";

function mockRes(body: string, status = 400, statusText = "Bad Request"): Response {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("throwAtlassianError", () => {
  it("surfaces Jira/Confluence errorMessages array in the thrown error", async () => {
    const res = mockRes(
      JSON.stringify({
        errorMessages: ["Unbounded JQL queries are not allowed here."],
        errors: {},
      }),
    );
    await expect(throwAtlassianError(res, "Failed to search issues")).rejects.toThrow(
      /Failed to search issues: 400 Bad Request — Unbounded JQL queries are not allowed here\./,
    );
  });

  it("surfaces field-level errors from errors object", async () => {
    const res = mockRes(
      JSON.stringify({
        errorMessages: [],
        errors: { project: "project is required", summary: "summary cannot be empty" },
      }),
    );
    await expect(throwAtlassianError(res, "Failed to create issue")).rejects.toThrow(
      /project is required.*summary cannot be empty/,
    );
  });

  it("surfaces Bitbucket Cloud error.message shape", async () => {
    const res = mockRes(
      JSON.stringify({ error: { message: "Repository not found" } }),
      404,
      "Not Found",
    );
    await expect(throwAtlassianError(res, "Failed to list repos")).rejects.toThrow(
      /Failed to list repos: 404 Not Found — Repository not found/,
    );
  });

  it("falls back to raw body (truncated) when JSON parse fails", async () => {
    const res = mockRes("<html>500 Internal Server Error</html>", 500, "Internal Server Error");
    await expect(throwAtlassianError(res, "Failed to fetch")).rejects.toThrow(
      /Failed to fetch: 500 Internal Server Error — <html>500 Internal Server Error<\/html>/,
    );
  });

  it("returns status-only error when body cannot be read", async () => {
    const res = {
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      // no text() — will throw TypeError
    } as unknown as Response;
    await expect(throwAtlassianError(res, "Failed to fetch")).rejects.toThrow(
      "Failed to fetch: 502 Bad Gateway",
    );
  });
});
