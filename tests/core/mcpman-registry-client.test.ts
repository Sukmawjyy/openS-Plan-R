/**
 * mcpman-registry-client.test.ts
 * Tests for mcpman registry HTTP client functions.
 * Mocks global fetch to avoid real network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCPMAN_REGISTRY_BASE,
  getMcpmanPackage,
  publishToMcpmanRegistry,
  resolveFromMcpman,
  searchMcpmanRegistry,
} from "../../src/core/mcpman-registry-client.js";
import type { McpmanPackage, McpmanSearchResult, PublishOptions } from "../../src/core/mcpman-registry-client.js";

// ── Mock fetch ────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function makePackage(overrides: Partial<McpmanPackage> = {}): McpmanPackage {
  return {
    name: "test-pkg",
    description: "A test package",
    version: "1.0.0",
    author: "test-author",
    type: "server",
    downloads: 42,
    trustScore: 0.9,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

function makeSearchResult(overrides: Partial<McpmanSearchResult> = {}): McpmanSearchResult {
  return {
    name: "test-pkg",
    description: "A test package",
    version: "1.0.0",
    type: "server",
    downloads: 10,
    trustScore: 0.8,
    author: "author",
    ...overrides,
  };
}

const BASE_PUBLISH_OPTIONS: PublishOptions = {
  name: "my-pkg",
  version: "1.2.3",
  description: "My package",
  type: "server",
  runtime: "node",
  command: "node",
  args: ["dist/index.js"],
  tarballPath: "/tmp/my-pkg.tgz",
  checksum: "sha256-abc123",
  token: "tok-secret",
};

// ── searchMcpmanRegistry ──────────────────────────────────────────────────────

describe("searchMcpmanRegistry()", () => {
  it("returns search results on success", async () => {
    const results = [makeSearchResult(), makeSearchResult({ name: "another-pkg" })];
    fetchMock.mockResolvedValueOnce(makeResponse({ results }));

    const data = await searchMcpmanRegistry("test");

    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("test-pkg");
    expect(data[1].name).toBe("another-pkg");
  });

  it("uses correct URL with encoded query and limit", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ results: [] }));

    await searchMcpmanRegistry("hello world", 10);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`${MCPMAN_REGISTRY_BASE}/search`);
    expect(calledUrl).toContain("q=hello%20world");
    expect(calledUrl).toContain("limit=10");
  });

  it("caps limit at 100", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ results: [] }));

    await searchMcpmanRegistry("query", 999);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("limit=100");
  });

  it("returns [] on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 500));

    const data = await searchMcpmanRegistry("fail");

    expect(data).toEqual([]);
  });

  it("returns [] on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const data = await searchMcpmanRegistry("fail");

    expect(data).toEqual([]);
  });

  it("returns [] when response has no results field", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ other: "data" }));

    const data = await searchMcpmanRegistry("q");

    expect(data).toEqual([]);
  });

  it("returns [] when results is not an array", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ results: "not-array" }));

    const data = await searchMcpmanRegistry("q");

    expect(data).toEqual([]);
  });

  it("filters out results with empty name", async () => {
    const results = [
      makeSearchResult({ name: "valid-pkg" }),
      makeSearchResult({ name: "" }),
    ];
    fetchMock.mockResolvedValueOnce(makeResponse({ results }));

    const data = await searchMcpmanRegistry("q");

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("valid-pkg");
  });

  it("uses default limit of 20 when not specified", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ results: [] }));

    await searchMcpmanRegistry("q");

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("limit=20");
  });

  it("returns empty array when results contains non-string name entries", async () => {
    const results = [
      { name: 123, description: "bad", version: "1.0.0", type: "server" },
      makeSearchResult({ name: "good" }),
    ];
    fetchMock.mockResolvedValueOnce(makeResponse({ results }));

    const data = await searchMcpmanRegistry("q");

    // name "123" is coerced to string "123" which is truthy — filtered out only empties
    expect(data.some((r) => r.name === "good")).toBe(true);
  });
});

// ── getMcpmanPackage ──────────────────────────────────────────────────────────

describe("getMcpmanPackage()", () => {
  it("returns package data on success", async () => {
    const pkg = makePackage();
    fetchMock.mockResolvedValueOnce(makeResponse(pkg));

    const result = await getMcpmanPackage("test-pkg");

    expect(result).toEqual(pkg);
    expect(result?.name).toBe("test-pkg");
    expect(result?.version).toBe("1.0.0");
  });

  it("calls correct URL with encoded package name", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(makePackage()));

    await getMcpmanPackage("@scope/my-pkg");

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`${MCPMAN_REGISTRY_BASE}/packages/`);
    expect(calledUrl).toContain(encodeURIComponent("@scope/my-pkg"));
  });

  it("returns null on 404", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ error: "not found" }, 404));

    const result = await getMcpmanPackage("nonexistent-pkg");

    expect(result).toBeNull();
  });

  it("returns null on 500", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 500));

    const result = await getMcpmanPackage("some-pkg");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const result = await getMcpmanPackage("some-pkg");

    expect(result).toBeNull();
  });

  it("returns null on timeout (abort error)", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));

    const result = await getMcpmanPackage("some-pkg");

    expect(result).toBeNull();
  });
});

// ── publishToMcpmanRegistry ───────────────────────────────────────────────────

describe("publishToMcpmanRegistry()", () => {
  it("returns publish result on success", async () => {
    const publishResult = { name: "my-pkg", version: "1.2.3", url: "https://registry.mcpman.dev/packages/my-pkg" };
    fetchMock.mockResolvedValueOnce(makeResponse(publishResult));

    const result = await publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS);

    expect(result.name).toBe("my-pkg");
    expect(result.version).toBe("1.2.3");
    expect(result.url).toBe("https://registry.mcpman.dev/packages/my-pkg");
  });

  it("sends POST to /publish endpoint", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ name: "pkg", version: "1.0.0", url: "url" }));

    await publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS);

    expect(fetchMock).toHaveBeenCalledWith(
      `${MCPMAN_REGISTRY_BASE}/publish`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends Authorization header with Bearer token", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ name: "pkg", version: "1.0.0", url: "url" }));

    await publishToMcpmanRegistry({ ...BASE_PUBLISH_OPTIONS, token: "my-secret-token" });

    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-secret-token");
  });

  it("sends Content-Type: application/json", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ name: "pkg", version: "1.0.0", url: "url" }));

    await publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS);

    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does NOT include tarballPath in the request body", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ name: "pkg", version: "1.0.0", url: "url" }));

    await publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS);

    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArgs.body as string) as Record<string, unknown>;
    expect(body.tarballPath).toBeUndefined();
    expect(body.token).toBeUndefined();
  });

  it("includes checksum in the request body", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ name: "pkg", version: "1.0.0", url: "url" }));

    await publishToMcpmanRegistry({ ...BASE_PUBLISH_OPTIONS, checksum: "sha256-deadbeef" });

    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArgs.body as string) as Record<string, unknown>;
    expect(body.checksum).toBe("sha256-deadbeef");
  });

  it("throws on 401 Unauthorized", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as unknown as Response);

    await expect(publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS)).rejects.toThrow(
      /Registry publish failed \(401\)/,
    );
  });

  it("throws on 500 server error with error message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as unknown as Response);

    await expect(publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS)).rejects.toThrow(
      /Registry publish failed \(500\)/,
    );
  });

  it("throws when text() itself fails — uses status code as fallback", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => { throw new Error("body read failed"); },
    } as unknown as Response);

    await expect(publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS)).rejects.toThrow(/503/);
  });

  it("throws on network error (not caught by publishToMcpmanRegistry)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(publishToMcpmanRegistry(BASE_PUBLISH_OPTIONS)).rejects.toThrow("ECONNREFUSED");
  });
});

// ── resolveFromMcpman ─────────────────────────────────────────────────────────

describe("resolveFromMcpman()", () => {
  it("resolves package to ServerMetadata", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(makePackage({ name: "my-server", version: "2.0.0" })));

    const meta = await resolveFromMcpman("my-server");

    expect(meta.name).toBe("my-server");
    expect(meta.version).toBe("2.0.0");
    expect(meta.runtime).toBe("node");
    expect(meta.command).toBe("npx");
    expect(meta.args).toContain("-y");
    expect(meta.args).toContain("my-server@2.0.0");
    expect(meta.resolved).toBe("mcpman:my-server");
  });

  it("sets envVars to empty array", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(makePackage()));

    const meta = await resolveFromMcpman("test-pkg");

    expect(meta.envVars).toEqual([]);
  });

  it("throws when package is not found (404)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 404));

    await expect(resolveFromMcpman("nonexistent")).rejects.toThrow(
      "Package 'nonexistent' not found on mcpman registry",
    );
  });

  it("throws when fetch fails with network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));

    await expect(resolveFromMcpman("some-pkg")).rejects.toThrow(
      "Package 'some-pkg' not found on mcpman registry",
    );
  });

  it("uses package name from registry response in args", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(makePackage({ name: "@org/fancy-server", version: "3.1.0" })));

    const meta = await resolveFromMcpman("@org/fancy-server");

    expect(meta.args).toContain("@org/fancy-server@3.1.0");
  });

  it("includes description in ServerMetadata", async () => {
    const pkg = makePackage({ description: "Does something amazing" });
    fetchMock.mockResolvedValueOnce(makeResponse(pkg));

    const meta = await resolveFromMcpman("test-pkg");

    expect(meta.description).toBe("Does something amazing");
  });
});
