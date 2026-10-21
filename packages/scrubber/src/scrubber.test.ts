import { describe, it, expect } from "vitest";
import { PiiScrubber } from "./scrubber.js";

describe("PiiScrubber", () => {
  it("scrubs email addresses", () => {
    const scrubber = new PiiScrubber();
    expect(scrubber.scrubText("Contact jane.doe@example.com")).toBe("Contact [EMAIL]");
  });

  it("scrubs phone numbers", () => {
    const scrubber = new PiiScrubber();
    expect(scrubber.scrubText("Call 250-555-1234")).toBe("Call [PHONE]");
    expect(scrubber.scrubText("Call (250) 555-1234")).toBe("Call [PHONE]");
  });

  it("scrubs bearer tokens", () => {
    const scrubber = new PiiScrubber();
    expect(scrubber.scrubText("Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).toBe("Bearer [TOKEN]");
  });

  it("maps person names consistently", () => {
    const scrubber = new PiiScrubber();
    const result1 = scrubber.scrubName("Jane Doe");
    const result2 = scrubber.scrubName("Jane Doe");
    expect(result1).toBe(result2);
    expect(result1).not.toBe("Jane Doe");
    expect(result1).toMatch(/^Person-\d+$/);
  });

  it("maps different names to different pseudonyms", () => {
    const scrubber = new PiiScrubber();
    const r1 = scrubber.scrubName("Jane Doe");
    const r2 = scrubber.scrubName("John Smith");
    expect(r1).not.toBe(r2);
  });

  it("scrubs API keys/secrets", () => {
    const scrubber = new PiiScrubber();
    expect(scrubber.scrubText("key=" + "sk_live_" + "syntheticfixture0000")).toContain("[REDACTED]");
  });

  it("returns null for null/undefined names", () => {
    const scrubber = new PiiScrubber();
    expect(scrubber.scrubName(null)).toBeNull();
    expect(scrubber.scrubName(undefined)).toBeNull();
  });

  it("resets name mappings", () => {
    const scrubber = new PiiScrubber();
    const r1 = scrubber.scrubName("Jane Doe");
    scrubber.reset();
    const r2 = scrubber.scrubName("Jane Doe");
    expect(r1).toBe(r2); // Same pseudonym format but starts over
    expect(r2).toBe("Person-1");
  });
});
