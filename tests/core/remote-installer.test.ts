/**
 * remote-installer.test.ts
 * Unit tests for resolveTransport(), validateRemoteUrl(), and buildRemoteEntry()
 * from src/core/remote-installer.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildRemoteEntry,
  resolveTransport,
  validateRemoteUrl,
} from "../../src/core/remote-installer.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── resolveTransport ───────────────────────────────────────────────────────────

describe("resolveTransport() — auto-detection", () => {
  it("detects sse transport for URL ending in /sse", () => {
    expect(resolveTransport("https://example.com/mcp/sse")).toBe("sse");
  });

  it("detects sse transport for URL ending in /sse/", () => {
    expect(resolveTransport("https://example.com/mcp/sse/")).toBe("sse");
  });

  it("detects sse transport for URL ending in /events", () => {
    expect(resolveTransport("https://example.com/stream/events")).toBe("sse");
  });

  it("detects sse transport for URL ending in /events/", () => {
    expect(resolveTransport("https://example.com/stream/events/")).toBe("sse");
  });

  it("defaults to http for plain endpoint URL", () => {
    expect(resolveTransport("https://example.com/mcp")).toBe("http");
  });

  it("defaults to http for URL with unrelated path segments", () => {
    expect(resolveTransport("https://example.com/api/v1/tools")).toBe("http");
  });

  it("case-insensitive: detects /SSE", () => {
    expect(resolveTransport("https://example.com/SSE")).toBe("sse");
  });

  it("case-insensitive: detects /EVENTS", () => {
    expect(resolveTransport("https://example.com/EVENTS")).toBe("sse");
  });
});

describe("resolveTransport() — explicit transport", () => {
  it("respects explicit 'sse' transport regardless of URL", () => {
    expect(resolveTransport("https://example.com/mcp", "sse")).toBe("sse");
  });

  it("respects explicit 'http' transport even for /sse URL", () => {
    expect(resolveTransport("https://example.com/sse", "http")).toBe("http");
  });

  it("ignores explicit 'stdio' and falls back to auto-detection (http)", () => {
    // stdio is treated as absent — auto-detection applies
    expect(resolveTransport("https://example.com/mcp", "stdio")).toBe("http");
  });

  it("ignores explicit 'stdio' and falls back to auto-detection (sse)", () => {
    expect(resolveTransport("https://example.com/events", "stdio")).toBe("sse");
  });
});

// ── validateRemoteUrl ──────────────────────────────────────────────────────────

describe("validateRemoteUrl() — valid URLs", () => {
  it("accepts https URL", () => {
    const result = validateRemoteUrl("https://example.com/mcp");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts http URL", () => {
    const result = validateRemoteUrl("http://localhost:3000/mcp");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts https URL with path and query", () => {
    const result = validateRemoteUrl("https://api.example.com/v1/mcp?token=abc");
    expect(result.valid).toBe(true);
  });

  it("accepts https URL with port", () => {
    const result = validateRemoteUrl("https://example.com:8443/mcp");
    expect(result.valid).toBe(true);
  });
});

describe("validateRemoteUrl() — rejected protocols", () => {
  it("rejects ftp:// protocol", () => {
    const result = validateRemoteUrl("ftp://example.com/mcp");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported protocol/i);
  });

  it("rejects ws:// protocol", () => {
    const result = validateRemoteUrl("ws://example.com/mcp");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported protocol/i);
  });

  it("rejects file:// protocol", () => {
    const result = validateRemoteUrl("file:///etc/passwd");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported protocol/i);
  });
});

describe("validateRemoteUrl() — malformed URLs", () => {
  it("rejects bare string with no protocol", () => {
    const result = validateRemoteUrl("example.com/mcp");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid url/i);
  });

  it("rejects empty string", () => {
    const result = validateRemoteUrl("");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid url/i);
  });

  it("rejects completely random text", () => {
    const result = validateRemoteUrl("not a url at all");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid url/i);
  });
});

// ── buildRemoteEntry ───────────────────────────────────────────────────────────

describe("buildRemoteEntry() — type field", () => {
  it("sets type to 'http' for a plain URL", () => {
    const entry = buildRemoteEntry({ url: "https://example.com/mcp", name: "my-server" });
    expect(entry.type).toBe("http");
  });

  it("sets type to 'sse' for a /sse URL", () => {
    const entry = buildRemoteEntry({ url: "https://example.com/sse", name: "sse-server" });
    expect(entry.type).toBe("sse");
  });

  it("respects explicit transport override", () => {
    const entry = buildRemoteEntry({
      url: "https://example.com/mcp",
      name: "forced-sse",
      transport: "sse",
    });
    expect(entry.type).toBe("sse");
  });
});

describe("buildRemoteEntry() — url field", () => {
  it("preserves the original URL", () => {
    const url = "https://example.com/mcp";
    const entry = buildRemoteEntry({ url, name: "srv" });
    expect(entry.url).toBe(url);
  });
});

describe("buildRemoteEntry() — headers field", () => {
  it("includes headers when provided", () => {
    const entry = buildRemoteEntry({
      url: "https://example.com/mcp",
      name: "auth-server",
      headers: { Authorization: "Bearer token123" },
    });
    expect(entry.headers).toEqual({ Authorization: "Bearer token123" });
  });

  it("omits headers field when headers object is empty", () => {
    const entry = buildRemoteEntry({
      url: "https://example.com/mcp",
      name: "no-headers",
      headers: {},
    });
    expect(entry.headers).toBeUndefined();
  });

  it("omits headers field when headers are not provided", () => {
    const entry = buildRemoteEntry({ url: "https://example.com/mcp", name: "srv" });
    expect(entry.headers).toBeUndefined();
  });

  it("includes multiple headers correctly", () => {
    const headers = { Authorization: "Bearer tok", "X-Api-Key": "key123" };
    const entry = buildRemoteEntry({ url: "https://example.com/mcp", name: "srv", headers });
    expect(entry.headers).toEqual(headers);
  });
});
