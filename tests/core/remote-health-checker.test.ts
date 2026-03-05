/**
 * remote-health-checker.test.ts
 * Unit tests for checkRemoteEndpoint() and checkRemoteMcpHandshake()
 * from src/core/remote-health-checker.ts.
 * Mocks global fetch to avoid real network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRemoteEndpoint,
  checkRemoteMcpHandshake,
} from "../../src/core/remote-health-checker.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a minimal Response-like object for vi.stubGlobal fetch mock */
function makeFetchResponse(opts: {
  status: number;
  statusText?: string;
  ok?: boolean;
  json?: () => Promise<unknown>;
}): Response {
  return {
    status: opts.status,
    statusText: opts.statusText ?? "",
    ok: opts.ok ?? (opts.status >= 200 && opts.status < 300),
    json: opts.json ?? (() => Promise.resolve({})),
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    body: null,
    bodyUsed: false,
    clone: () => { throw new Error("clone not implemented"); },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(""),
  } as unknown as Response;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── checkRemoteEndpoint ────────────────────────────────────────────────────────

describe("checkRemoteEndpoint() — passed cases", () => {
  it("returns passed=true for HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ status: 200, ok: true }));

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(true);
    expect(result.message).toContain("200");
  });

  it("returns passed=true for HTTP 201", async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ status: 201, ok: true }));

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(true);
    expect(result.message).toContain("201");
  });

  it("returns passed=true for HTTP 405 (Method Not Allowed — endpoint exists)", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 405, statusText: "Method Not Allowed", ok: false }),
    );

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(true);
    expect(result.message).toContain("405");
  });

  it("has name 'Remote endpoint'", async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ status: 200, ok: true }));

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.name).toBe("Remote endpoint");
  });
});

describe("checkRemoteEndpoint() — failed cases", () => {
  it("returns passed=false for HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 500, statusText: "Internal Server Error", ok: false }),
    );

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toContain("500");
  });

  it("returns passed=false for HTTP 404", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 404, statusText: "Not Found", ok: false }),
    );

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toContain("404");
  });

  it("returns passed=false for HTTP 503", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 503, statusText: "Service Unavailable", ok: false }),
    );

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(false);
  });

  it("returns passed=false when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await checkRemoteEndpoint("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toContain("ECONNREFUSED");
  });

  it("returns passed=false when fetch throws abort (timeout)", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

    const result = await checkRemoteEndpoint("https://example.com/mcp", 1);

    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/unreachable/i);
  });
});

// ── checkRemoteMcpHandshake ────────────────────────────────────────────────────

describe("checkRemoteMcpHandshake() — passed cases", () => {
  it("returns passed=true for valid JSON-RPC initialize response", async () => {
    const validResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({
        status: 200,
        ok: true,
        json: () => Promise.resolve(validResponse),
      }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(true);
    expect(result.message).toMatch(/initialize ok/i);
  });

  it("has name 'MCP handshake (HTTP)'", async () => {
    const validResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({
        status: 200,
        ok: true,
        json: () => Promise.resolve(validResponse),
      }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.name).toBe("MCP handshake (HTTP)");
  });

  it("passes custom headers to fetch", async () => {
    const validResponse = { jsonrpc: "2.0", id: 1, result: {} };
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({
        status: 200,
        ok: true,
        json: () => Promise.resolve(validResponse),
      }),
    );

    await checkRemoteMcpHandshake(
      "https://example.com/mcp",
      { Authorization: "Bearer mytoken" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/mcp",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer mytoken" }),
      }),
    );
  });
});

describe("checkRemoteMcpHandshake() — failed cases", () => {
  it("returns passed=false for non-200 HTTP status", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 401, statusText: "Unauthorized", ok: false }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toContain("401");
  });

  it("returns passed=false for HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 500, statusText: "Internal Server Error", ok: false }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toContain("500");
  });

  it("returns passed=false when JSON-RPC contains error field instead of result", async () => {
    const errorResponse = { jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid Request" } };
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({
        status: 200,
        ok: true,
        json: () => Promise.resolve(errorResponse),
      }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/rpc error/i);
  });

  it("returns passed=false when response lacks jsonrpc field", async () => {
    const weirdResponse = { id: 1, result: { capabilities: {} } };
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({
        status: 200,
        ok: true,
        json: () => Promise.resolve(weirdResponse),
      }),
    );

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/unexpected response/i);
  });

  it("returns passed=false for network error (timeout / connection refused)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await checkRemoteMcpHandshake("https://example.com/mcp");

    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/failed/i);
  });

  it("returns passed=false on abort (timeout)", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

    const result = await checkRemoteMcpHandshake("https://example.com/mcp", {}, 1);

    expect(result.passed).toBe(false);
  });
});
