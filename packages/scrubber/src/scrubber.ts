export class PiiScrubber {
  private nameMap = new Map<string, string>();
  private nextId = 1;

  scrubText(text: string): string {
    let result = text;
    // Bearer tokens
    result = result.replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/g, "Bearer [TOKEN]");
    // API keys / secrets (16+ alphanumeric chars after key-like prefix)
    result = result.replace(
      /(?:api[_-]?key|key|secret|token|password|credential|authorization)\s*[=:]\s*\S{16,}/gi,
      (match) => match.replace(/\S{16,}/, "[REDACTED]")
    );
    // Email addresses
    result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
    // Phone numbers (NA formats)
    result = result.replace(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[PHONE]");
    // Known names
    for (const [name, pseudonym] of this.nameMap) {
      result = result.replaceAll(name, pseudonym);
    }
    return result;
  }

  scrubName(displayName: string | null | undefined): string | null {
    if (!displayName) return null;
    if (this.nameMap.has(displayName)) return this.nameMap.get(displayName)!;
    const pseudonym = `Person-${this.nextId++}`;
    this.nameMap.set(displayName, pseudonym);
    return pseudonym;
  }

  reset(): void {
    this.nameMap.clear();
    this.nextId = 1;
  }
}
