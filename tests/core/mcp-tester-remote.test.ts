/**
 * mcp-tester-remote.test.ts
 * Unit tests for testRemoteMcpServer() from src/core/mcp-tester.ts.
 * Mocks global fetch to simulate JSON-RPC responses over HTTP.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testRemoteMcpServer } from "../../src/core/mcp-tester.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a minimal Response-like object */
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

const TEST_URL = "https://example.com/mcp";

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

// ── testRemoteMcpServer — success path ────────────────────────────────────────

describe("testRemoteMcpServer() — successful handshake", () => {
  it("returns passed=true when initialize and tools/list both succeed", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    const toolsResponse = {
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [
          { name: "read_file" },
          { name: "write_file" },
        ],
      },
    };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("my-server", TEST_URL);

    expect(result.passed).toBe(true);
    expect(result.initializeOk).toBe(true);
    expect(result.toolsListOk).toBe(true);
  });

  it("extracts tool names from tools/list response", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    const toolsResponse = {
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [
          { name: "search" },
          { name: "fetch_url" },
          { name: "bash" },
        ],
      },
    };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("tool-server", TEST_URL);

    expect(result.tools).toEqual(["search", "fetch_url", "bash"]);
  });

  it("handles empty tools array", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    const toolsResponse = { jsonrpc: "2.0", id: 2, result: { tools: [] } };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("empty-server", TEST_URL);

    expect(result.passed).toBe(true);
    expect(result.tools).toEqual([]);
  });

  it("filters out tools with missing name field", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };
    const toolsResponse = {
      jsonrpc: "2.0",
      id: 2,
      result: { tools: [{ name: "good-tool" }, {}, { name: "" }] },
    };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.tools).toEqual(["good-tool"]);
  });

  it("includes serverName in result", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: {} };
    const toolsResponse = { jsonrpc: "2.0", id: 2, result: { tools: [] } };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("named-server", TEST_URL);

    expect(result.serverName).toBe("named-server");
  });

  it("includes non-negative responseTimeMs", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: {} };
    const toolsResponse = { jsonrpc: "2.0", id: 2, result: { tools: [] } };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("sends custom headers on every fetch call", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: {} };
    const toolsResponse = { jsonrpc: "2.0", id: 2, result: { tools: [] } };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(toolsResponse) }),
      );

    const headers = { Authorization: "Bearer secret" };
    await testRemoteMcpServer("srv", TEST_URL, headers);

    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers).toMatchObject({ Authorization: "Bearer secret" });
    }
  });
});

// ── testRemoteMcpServer — HTTP errors ─────────────────────────────────────────

describe("testRemoteMcpServer() — HTTP errors", () => {
  it("returns passed=false when initialize returns HTTP 401", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 401, statusText: "Unauthorized", ok: false }),
    );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.initializeOk).toBe(false);
    expect(result.toolsListOk).toBe(false);
    expect(result.error).toContain("401");
  });

  it("returns passed=false when initialize returns HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 500, statusText: "Internal Server Error", ok: false }),
    );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.error).toContain("500");
  });

  it("returns passed=false when tools/list returns HTTP error", async () => {
    const initResponse = { jsonrpc: "2.0", id: 1, result: { capabilities: {} } };

    fetchMock
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(initResponse) }),
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ status: 503, statusText: "Service Unavailable", ok: false }),
      );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.error).toContain("503");
  });

  it("returns passed=false when initialize response has no result", async () => {
    const badInitResponse = { jsonrpc: "2.0", id: 1, error: { code: -1, message: "oops" } };

    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ status: 200, ok: true, json: () => Promise.resolve(badInitResponse) }),
    );

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.initializeOk).toBe(false);
    expect(result.error).toMatch(/initialize failed/i);
  });
});

// ── testRemoteMcpServer — network errors ──────────────────────────────────────

describe("testRemoteMcpServer() — network / fetch errors", () => {
  it("returns passed=false when fetch throws a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("returns passed=false when fetch is aborted", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("still returns serverName on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await testRemoteMcpServer("named-server", TEST_URL);

    expect(result.serverName).toBe("named-server");
  });

  it("returns non-negative responseTimeMs even on error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns empty tools array on error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await testRemoteMcpServer("srv", TEST_URL);

    expect(result.tools).toEqual([]);
  });
});
