import { describe, it, expect } from "vitest";
import { adfToText, textToAdf } from "./adf.js";

describe("adfToText", () => {
  it("returns empty string for null", () => {
    expect(adfToText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(adfToText(undefined)).toBe("");
  });

  it("returns string as-is for string input", () => {
    expect(adfToText("hello world")).toBe("hello world");
  });

  it("extracts text from a single paragraph", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Hello\n");
  });

  it("extracts text from multiple paragraphs", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line 1" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line 2" }],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Line 1\nLine 2\n");
  });

  it("handles nested nodes (heading with text)", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Some " },
            { type: "text", text: "content" },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Title\nSome content\n");
  });

  it("handles text node with missing text property", () => {
    const adf = { type: "text" };
    expect(adfToText(adf)).toBe("");
  });
});

describe("textToAdf", () => {
  it("wraps single line in ADF doc", () => {
    const result = textToAdf("Hello");
    expect(result).toEqual({
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    });
  });

  it("wraps multiple lines in separate paragraphs", () => {
    const result = textToAdf("Line 1\nLine 2\nLine 3");
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
    expect(result.content).toHaveLength(3);
    const content = result.content as Array<{ type: string; content: Array<{ type: string; text: string }> }>;
    expect(content[0].content[0].text).toBe("Line 1");
    expect(content[1].content[0].text).toBe("Line 2");
    expect(content[2].content[0].text).toBe("Line 3");
  });
});

describe("round-trip", () => {
  it("textToAdf -> adfToText preserves content", () => {
    const original = "First paragraph\nSecond paragraph";
    const adf = textToAdf(original);
    const result = adfToText(adf).trim();
    expect(result).toBe(original);
  });
});
