interface ClassifiedError {
  userMessage: string;
  logLevel: "warn" | "error";
  shouldInvalidateSession: boolean;
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof Error) {
    const msg = err.message;
    const status = (err as any).status as number | undefined;

    if (status === 429 || msg.includes("429") || /rate.?limit/i.test(msg)) {
      return {
        userMessage: "The AI service is busy. Please try again in a moment.",
        logLevel: "warn",
        shouldInvalidateSession: false,
      };
    }

    if (status === 401 && !msg.includes("failed: 401")) {
      return {
        userMessage: "AI provider configuration error. Contact your administrator.",
        logLevel: "error",
        shouldInvalidateSession: false,
      };
    }

    if (msg.includes("failed: 401")) {
      return {
        userMessage: "Your Atlassian credentials have expired. Please log in again.",
        logLevel: "warn",
        shouldInvalidateSession: true,
      };
    }

    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("fetch failed")
    ) {
      return {
        userMessage: "A service is temporarily unavailable. Please try again.",
        logLevel: "error",
        shouldInvalidateSession: false,
      };
    }

    if (msg.includes("Maximum tool calls")) {
      return {
        userMessage: msg,
        logLevel: "warn",
        shouldInvalidateSession: false,
      };
    }
  }

  return {
    userMessage: "Something went wrong. Please try again.",
    logLevel: "error",
    shouldInvalidateSession: false,
  };
}
