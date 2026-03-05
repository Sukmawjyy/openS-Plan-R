/**
 * tests/mcp-server/tool-handlers.test.ts
 * Comprehensive tests for all 8 MCP tool handlers:
 *   handleInstall, handleRemove, handleSearch (tools-registry)
 *   handleAudit, handleDoctor            (tools-diagnostics)
 *   handleList, handleInfo, handleStatus  (tools-query)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LockfileData, LockEntry } from "../../src/core/lockfile.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../src/core/lockfile.js", () => ({
  readLockfile: vi.fn(),
  removeEntry: vi.fn(),
  getLockedVersion: vi.fn(),
}));

vi.mock("../../src/core/registry.js", () => ({
  resolveFromNpm: vi.fn(),
  resolveFromSmithery: vi.fn(),
  resolveFromGitHub: vi.fn(),
}));

vi.mock("../../src/core/registry-search.js", () => ({
  searchNpm: vi.fn(),
  searchSmithery: vi.fn(),
}));

vi.mock("../../src/core/health-checker.js", () => ({
  checkServerHealth: vi.fn(),
}));

vi.mock("../../src/core/security-scanner.js", () => ({
  scanServer: vi.fn(),
  scanAllServers: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { readLockfile, removeEntry, getLockedVersion } from "../../src/core/lockfile.js";
import { resolveFromNpm, resolveFromSmithery, resolveFromGitHub } from "../../src/core/registry.js";
import { searchNpm, searchSmithery } from "../../src/core/registry-search.js";
import { checkServerHealth } from "../../src/core/health-checker.js";
import { scanServer, scanAllServers } from "../../src/core/security-scanner.js";

import { handleInstall, handleRemove, handleSearch, setWriteEnabled } from "../../src/mcp-server/tools-registry.js";
import { handleAudit, handleDoctor } from "../../src/mcp-server/tools-diagnostics.js";
import { handleList, handleInfo, handleStatus } from "../../src/mcp-server/tools-query.js";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function makeLockfile(servers: LockfileData["servers"] = {}): LockfileData {
  return { lockfileVersion: 1, servers };
}

function makeLockEntry(overrides: Partial<LockEntry> = {}): LockEntry {
  return {
    version: "1.2.0",
    source: "npm",
    resolved: "https://registry.npmjs.org/test-mcp/-/test-mcp-1.2.0.tgz",
    integrity: "sha512-xxx",
    runtime: "node",
    command: "npx",
    args: ["-y", "test-mcp@1.2.0"],
    envVars: [],
    installedAt: "2025-01-01T00:00:00.000Z",
    clients: ["claude-desktop", "cursor"],
    ...overrides,
  };
}

function makeServerMeta(overrides: Partial<{
  name: string; version: string; description: string;
  runtime: "node" | "python" | "docker"; command: string; args: string[];
  envVars: unknown[]; resolved: string;
}> = {}) {
  return {
    name: "test-mcp",
    version: "1.2.0",
    description: "A test MCP server",
    runtime: "node" as const,
    command: "npx",
    args: ["-y", "test-mcp@1.2.0"],
    envVars: [],
    resolved: "https://registry.npmjs.org/test-mcp/-/test-mcp-1.2.0.tgz",
    ...overrides,
  };
}

/** Extract text from CallToolResult content[0] */
function getText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0].text;
}

// ─── textResult helper ───────────────────────────────────────────────────────

describe("textResult()", () => {
  it("wraps string in CallToolResult format", async () => {
    const { textResult } = await import("../../src/mcp-server/tool-helpers.js");
    const result = textResult("hello world");
    expect(result).toEqual({ content: [{ type: "text", text: "hello world" }] });
  });

  it("handles empty string", async () => {
    const { textResult } = await import("../../src/mcp-server/tool-helpers.js");
    const result = textResult("");
    expect(result.content[0].text).toBe("");
  });

  it("handles multiline string", async () => {
    const { textResult } = await import("../../src/mcp-server/tool-helpers.js");
    const result = textResult("line1\nline2\nline3");
    expect(result.content[0].text).toContain("line1");
    expect(result.content[0].text).toContain("line3");
  });
});

// ─── handleInstall ────────────────────────────────────────────────────────────

describe("handleInstall()", () => {
  beforeEach(() => {
    vi.mocked(resolveFromNpm).mockReset();
    vi.mocked(resolveFromSmithery).mockReset();
    vi.mocked(resolveFromGitHub).mockReset();
  });

  it("returns error when 'name' is missing", async () => {
    const result = await handleInstall({});
    expect(getText(result)).toContain("Error");
    expect(getText(result)).toContain("name");
  });

  it("returns error when 'name' is empty string", async () => {
    const result = await handleInstall({ name: "" });
    expect(getText(result)).toContain("Error");
  });

  it("returns remote note when url is provided", async () => {
    const result = await handleInstall({ name: "my-server", url: "https://example.com/mcp" });
    const text = getText(result);
    expect(text).toContain("my-server");
    expect(text).toContain("https://example.com/mcp");
    expect(text).toContain("Remote server");
  });

  it("does not call registry when url is provided", async () => {
    await handleInstall({ name: "my-server", url: "https://example.com/mcp" });
    expect(resolveFromNpm).not.toHaveBeenCalled();
    expect(resolveFromSmithery).not.toHaveBeenCalled();
    expect(resolveFromGitHub).not.toHaveBeenCalled();
  });

  it("resolves from GitHub when name starts with https://github.com/", async () => {
    vi.mocked(resolveFromGitHub).mockResolvedValue(makeServerMeta({ name: "owner/repo" }));
    const result = await handleInstall({ name: "https://github.com/owner/repo" });
    expect(resolveFromGitHub).toHaveBeenCalledWith("https://github.com/owner/repo");
    expect(getText(result)).toContain("owner/repo");
  });

  it("tries npm then smithery for owner/repo (not GitHub URL)", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta({ name: "owner/repo" }));
    const result = await handleInstall({ name: "owner/repo" });
    expect(resolveFromNpm).toHaveBeenCalledWith("owner/repo");
    expect(resolveFromGitHub).not.toHaveBeenCalled();
    expect(getText(result)).toContain("Resolved");
  });

  it("resolves from npm for regular package name", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta());
    const result = await handleInstall({ name: "test-mcp" });
    expect(resolveFromNpm).toHaveBeenCalledWith("test-mcp");
    const text = getText(result);
    expect(text).toContain("Resolved");
    expect(text).toContain("test-mcp@1.2.0");
  });

  it("falls back to Smithery when npm resolution fails", async () => {
    vi.mocked(resolveFromNpm).mockRejectedValue(new Error("not found on npm"));
    vi.mocked(resolveFromSmithery).mockResolvedValue(
      makeServerMeta({ name: "smithery-mcp", description: "Smithery server" })
    );
    const result = await handleInstall({ name: "smithery-mcp" });
    expect(resolveFromSmithery).toHaveBeenCalledWith("smithery-mcp");
    const text = getText(result);
    expect(text).toContain("Resolved");
    expect(text).toContain("smithery-mcp");
  });

  it("returns error when both npm and smithery resolution fail", async () => {
    vi.mocked(resolveFromNpm).mockRejectedValue(new Error("npm down"));
    vi.mocked(resolveFromSmithery).mockRejectedValue(new Error("smithery down"));
    const result = await handleInstall({ name: "mystery-pkg" });
    expect(getText(result)).toContain("Error resolving");
    expect(getText(result)).toContain("mystery-pkg");
  });

  it("includes description in output when present", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(
      makeServerMeta({ description: "Useful MCP integration" })
    );
    const result = await handleInstall({ name: "test-mcp" });
    expect(getText(result)).toContain("Useful MCP integration");
  });

  it("omits description line when description is empty", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta({ description: "" }));
    const result = await handleInstall({ name: "test-mcp" });
    expect(getText(result)).not.toContain("Desc:");
  });

  it("includes CLI hint in output", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta());
    const result = await handleInstall({ name: "test-mcp" });
    expect(getText(result)).toContain("mcpman install");
  });

  it("includes runtime and command in output", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta({ runtime: "node", command: "npx" }));
    const result = await handleInstall({ name: "test-mcp" });
    const text = getText(result);
    expect(text).toContain("Runtime:");
    expect(text).toContain("Command:");
  });

  it("handles @scoped package names correctly (does not route to GitHub)", async () => {
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta({ name: "@org/mcp-tool" }));
    const result = await handleInstall({ name: "@org/mcp-tool" });
    expect(resolveFromNpm).toHaveBeenCalledWith("@org/mcp-tool");
    expect(resolveFromGitHub).not.toHaveBeenCalled();
    expect(getText(result)).toContain("Resolved");
  });
});

// ─── handleRemove ─────────────────────────────────────────────────────────────

describe("handleRemove()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
    vi.mocked(removeEntry).mockReset();
    setWriteEnabled(true); // Enable writes for remove tests
  });

  it("returns error when 'name' is missing", async () => {
    const result = await handleRemove({});
    expect(getText(result)).toContain("Error");
    expect(getText(result)).toContain("name");
  });

  it("returns error when 'name' is empty string", async () => {
    const result = await handleRemove({ name: "" });
    expect(getText(result)).toContain("Error");
  });

  it("returns not-found message when server is not in lockfile", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleRemove({ name: "nonexistent-server" });
    expect(getText(result)).toContain("nonexistent-server");
    expect(getText(result)).toContain("not found");
  });

  it("calls removeEntry and returns success when server exists", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "test-mcp": makeLockEntry() })
    );
    const result = await handleRemove({ name: "test-mcp" });
    expect(removeEntry).toHaveBeenCalledWith("test-mcp");
    expect(getText(result)).toContain("test-mcp");
    expect(getText(result)).toContain("removed");
  });

  it("returns error message when removeEntry throws", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "bad-server": makeLockEntry() })
    );
    vi.mocked(removeEntry).mockImplementation(() => {
      throw new Error("write permission denied");
    });
    const result = await handleRemove({ name: "bad-server" });
    expect(getText(result)).toContain("Error removing");
    expect(getText(result)).toContain("write permission denied");
  });

  it("returns error when readLockfile throws", async () => {
    vi.mocked(readLockfile).mockImplementation(() => {
      throw new Error("disk read error");
    });
    const result = await handleRemove({ name: "any-server" });
    expect(getText(result)).toContain("Error removing");
    expect(getText(result)).toContain("disk read error");
  });
});

// ─── handleSearch ─────────────────────────────────────────────────────────────

describe("handleSearch()", () => {
  beforeEach(() => {
    vi.mocked(searchNpm).mockReset();
    vi.mocked(searchSmithery).mockReset();
  });

  it("returns error when 'query' is missing", async () => {
    const result = await handleSearch({});
    expect(getText(result)).toContain("Error");
    expect(getText(result)).toContain("query");
  });

  it("returns error when 'query' is empty string", async () => {
    const result = await handleSearch({ query: "" });
    expect(getText(result)).toContain("Error");
  });

  it("returns no-results message when both registries return empty", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([]);
    const result = await handleSearch({ query: "nonexistent-xyz" });
    expect(getText(result)).toContain("No results");
    expect(getText(result)).toContain("nonexistent-xyz");
  });

  it("shows npm results with version and downloads", async () => {
    vi.mocked(searchNpm).mockResolvedValue([
      { name: "mcp-tool", description: "A tool", version: "2.0.0", date: "", keywords: [], downloads: 9999 },
    ]);
    vi.mocked(searchSmithery).mockResolvedValue([]);
    const result = await handleSearch({ query: "tool" });
    const text = getText(result);
    expect(text).toContain("mcp-tool@2.0.0");
    expect(text).toContain("9,999");
    expect(text).toContain("npm Registry");
  });

  it("shows Smithery results with verified badge", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([
      { name: "@smithery/brave", description: "Brave search", useCount: 5, verified: true, homepage: "" },
    ]);
    const result = await handleSearch({ query: "brave" });
    const text = getText(result);
    expect(text).toContain("Smithery Registry");
    expect(text).toContain("@smithery/brave");
    expect(text).toContain("[verified]");
  });

  it("shows Smithery results without verified badge when not verified", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([
      { name: "unverified-mcp", description: "test", useCount: 1, verified: false, homepage: "" },
    ]);
    const result = await handleSearch({ query: "unverified" });
    expect(getText(result)).not.toContain("[verified]");
  });

  it("shows both npm and Smithery results together", async () => {
    vi.mocked(searchNpm).mockResolvedValue([
      { name: "npm-mcp", description: "npm result", version: "1.0.0", date: "", keywords: [], downloads: 100 },
    ]);
    vi.mocked(searchSmithery).mockResolvedValue([
      { name: "smithery-mcp", description: "smithery result", useCount: 5, verified: false, homepage: "" },
    ]);
    const result = await handleSearch({ query: "mcp" });
    const text = getText(result);
    expect(text).toContain("npm Registry");
    expect(text).toContain("Smithery Registry");
    expect(text).toContain("npm-mcp");
    expect(text).toContain("smithery-mcp");
  });

  it("uses default limit of 10 when not specified", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([]);
    await handleSearch({ query: "test" });
    expect(searchNpm).toHaveBeenCalledWith("test", 10);
    expect(searchSmithery).toHaveBeenCalledWith("test", 10);
  });

  it("passes custom limit to both registries", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([]);
    await handleSearch({ query: "test", limit: 5 });
    expect(searchNpm).toHaveBeenCalledWith("test", 5);
    expect(searchSmithery).toHaveBeenCalledWith("test", 5);
  });

  it("returns error message when search throws", async () => {
    vi.mocked(searchNpm).mockRejectedValue(new Error("network failure"));
    vi.mocked(searchSmithery).mockRejectedValue(new Error("network failure"));
    const result = await handleSearch({ query: "test" });
    expect(getText(result)).toContain("Error searching");
    expect(getText(result)).toContain("network failure");
  });

  it("shows no-description fallback for npm result with empty description", async () => {
    vi.mocked(searchNpm).mockResolvedValue([
      { name: "silent-mcp", description: "", version: "1.0.0", date: "", keywords: [], downloads: 10 },
    ]);
    vi.mocked(searchSmithery).mockResolvedValue([]);
    const result = await handleSearch({ query: "silent" });
    expect(getText(result)).toContain("(no description)");
  });

  it("shows no-description fallback for Smithery result with empty description", async () => {
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue([
      { name: "silent-smithery", description: "", useCount: 0, verified: false, homepage: "" },
    ]);
    const result = await handleSearch({ query: "silent" });
    expect(getText(result)).toContain("(no description)");
  });

  it("respects limit when slicing Smithery results", async () => {
    const manyResults = Array.from({ length: 20 }, (_, i) => ({
      name: `server-${i}`,
      description: "desc",
      useCount: i,
      verified: false,
      homepage: "",
    }));
    vi.mocked(searchNpm).mockResolvedValue([]);
    vi.mocked(searchSmithery).mockResolvedValue(manyResults);
    const result = await handleSearch({ query: "test", limit: 3 });
    const text = getText(result);
    // Only first 3 items should appear
    expect(text).toContain("server-0");
    expect(text).toContain("server-2");
    expect(text).not.toContain("server-3");
  });
});

// ─── handleAudit ─────────────────────────────────────────────────────────────

describe("handleAudit()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
    vi.mocked(scanServer).mockReset();
    vi.mocked(scanAllServers).mockReset();
  });

  it("returns 'no servers' message when lockfile is empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleAudit({});
    expect(getText(result)).toContain("No MCP servers installed");
  });

  it("returns not-found message for nonexistent specific server", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile({ "other-server": makeLockEntry() }));
    const result = await handleAudit({ server: "nonexistent" });
    expect(getText(result)).toContain("nonexistent");
    expect(getText(result)).toContain("not found");
  });

  it("calls scanAllServers when no specific server given", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "server-a": makeLockEntry(), "server-b": makeLockEntry() })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "server-a", source: "npm", score: 80, riskLevel: "LOW", vulnerabilities: [], metadata: null },
      { server: "server-b", source: "npm", score: 60, riskLevel: "MEDIUM", vulnerabilities: [], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(scanAllServers).toHaveBeenCalled();
    const text = getText(result);
    expect(text).toContain("server-a");
    expect(text).toContain("server-b");
    expect(text).toContain("2 server(s)");
  });

  it("calls scanServer when specific server given", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "test-mcp": makeLockEntry() })
    );
    vi.mocked(scanServer).mockResolvedValue({
      server: "test-mcp", source: "npm", score: 75, riskLevel: "MEDIUM",
      vulnerabilities: [{ severity: "moderate", title: "SSRF risk" }], metadata: null,
    });
    const result = await handleAudit({ server: "test-mcp" });
    expect(scanServer).toHaveBeenCalledWith("test-mcp", expect.any(Object));
    const text = getText(result);
    expect(text).toContain("test-mcp");
    expect(text).toContain("MEDIUM");
  });

  it("shows 'all clear' summary when no servers have issues", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "safe-server": makeLockEntry() })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "safe-server", source: "npm", score: 90, riskLevel: "LOW", vulnerabilities: [], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("all clear");
  });

  it("shows issue count when some servers have non-LOW risk", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "risky-a": makeLockEntry(), "risky-b": makeLockEntry() })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "risky-a", source: "npm", score: 30, riskLevel: "HIGH", vulnerabilities: [{ severity: "high", title: "CVE" }], metadata: null },
      { server: "risky-b", source: "npm", score: 10, riskLevel: "CRITICAL", vulnerabilities: [{ severity: "critical", title: "RCE" }], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("2 server(s) with issues");
  });

  it("shows score as N/A when score is null", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "smithery-srv": makeLockEntry({ source: "smithery" }) })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "smithery-srv", source: "smithery", score: null, riskLevel: "UNKNOWN", vulnerabilities: [], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("N/A");
  });

  it("correctly counts vulnerability/vulnerabilities singular", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "one-vuln": makeLockEntry() })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "one-vuln", source: "npm", score: 40, riskLevel: "HIGH", vulnerabilities: [{ severity: "high", title: "CVE-1" }], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("1 vulnerability/vulnerabilities");
  });

  it("shows 'no vulnerabilities' when none found", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "clean-server": makeLockEntry() })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "clean-server", source: "npm", score: 95, riskLevel: "LOW", vulnerabilities: [], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("no vulnerabilities");
  });

  it("returns error message when readLockfile throws", async () => {
    vi.mocked(readLockfile).mockImplementation(() => { throw new Error("lockfile corrupt"); });
    const result = await handleAudit({});
    expect(getText(result)).toContain("Error running audit");
    expect(getText(result)).toContain("lockfile corrupt");
  });

  it("UNKNOWN risk level does not count as 'with issues'", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "github-srv": makeLockEntry({ source: "github" }) })
    );
    vi.mocked(scanAllServers).mockResolvedValue([
      { server: "github-srv", source: "github", score: null, riskLevel: "UNKNOWN", vulnerabilities: [], metadata: null },
    ]);
    const result = await handleAudit({});
    expect(getText(result)).toContain("all clear");
  });
});

// ─── handleDoctor ─────────────────────────────────────────────────────────────

describe("handleDoctor()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
    vi.mocked(checkServerHealth).mockReset();
  });

  const makeHealthResult = (name: string, status: "healthy" | "unhealthy" | "unknown" = "healthy") => ({
    serverName: name,
    status,
    checks: [
      { name: "Runtime", passed: true, skipped: false, message: "node found" },
      { name: "Process", passed: status === "healthy", skipped: false, message: status === "healthy" ? "spawned" : "failed" },
    ],
  });

  it("returns 'no servers' when lockfile is empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleDoctor({});
    expect(getText(result)).toContain("No MCP servers installed");
  });

  it("returns not-found for nonexistent specific server", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile({ "other": makeLockEntry() }));
    const result = await handleDoctor({ server: "ghost" });
    expect(getText(result)).toContain("ghost");
    expect(getText(result)).toContain("not found");
  });

  it("checks all servers when no specific server given", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "srv-a": makeLockEntry(), "srv-b": makeLockEntry() })
    );
    vi.mocked(checkServerHealth)
      .mockResolvedValueOnce(makeHealthResult("srv-a", "healthy"))
      .mockResolvedValueOnce(makeHealthResult("srv-b", "unhealthy"));
    const result = await handleDoctor({});
    expect(checkServerHealth).toHaveBeenCalledTimes(2);
    const text = getText(result);
    expect(text).toContain("2 server(s)");
    expect(text).toContain("srv-a");
    expect(text).toContain("srv-b");
  });

  it("checks only specific server when server name given", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "target-srv": makeLockEntry() })
    );
    vi.mocked(checkServerHealth).mockResolvedValue(makeHealthResult("target-srv", "healthy"));
    const result = await handleDoctor({ server: "target-srv" });
    expect(checkServerHealth).toHaveBeenCalledTimes(1);
    expect(checkServerHealth).toHaveBeenCalledWith("target-srv", expect.any(Object));
    expect(getText(result)).toContain("target-srv");
  });

  it("reports healthy count correctly", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "srv-1": makeLockEntry(),
        "srv-2": makeLockEntry(),
        "srv-3": makeLockEntry(),
      })
    );
    vi.mocked(checkServerHealth)
      .mockResolvedValueOnce(makeHealthResult("srv-1", "healthy"))
      .mockResolvedValueOnce(makeHealthResult("srv-2", "healthy"))
      .mockResolvedValueOnce(makeHealthResult("srv-3", "unhealthy"));
    const result = await handleDoctor({});
    expect(getText(result)).toContain("3 server(s), 2 healthy");
  });

  it("shows check pass/fail symbols in output", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "my-srv": makeLockEntry() })
    );
    vi.mocked(checkServerHealth).mockResolvedValue({
      serverName: "my-srv",
      status: "unhealthy",
      checks: [
        { name: "Runtime", passed: true, skipped: false, message: "node found" },
        { name: "Process", passed: false, skipped: false, message: "spawn failed" },
        { name: "Handshake", passed: false, skipped: true, message: "skipped" },
      ],
    });
    const result = await handleDoctor({ server: "my-srv" });
    const text = getText(result);
    expect(text).toContain("✓");
    expect(text).toContain("✗");
    expect(text).toContain("·");
  });

  it("passes server config including transport and url to checkServerHealth", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "remote-srv": makeLockEntry({ transport: "http", url: "https://example.com/mcp" }),
      })
    );
    vi.mocked(checkServerHealth).mockResolvedValue(makeHealthResult("remote-srv"));
    await handleDoctor({ server: "remote-srv" });
    expect(checkServerHealth).toHaveBeenCalledWith(
      "remote-srv",
      expect.objectContaining({ url: "https://example.com/mcp", type: "http" })
    );
  });

  it("returns error when checkServerHealth throws", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "crash-srv": makeLockEntry() })
    );
    vi.mocked(checkServerHealth).mockRejectedValue(new Error("health check crashed"));
    const result = await handleDoctor({ server: "crash-srv" });
    expect(getText(result)).toContain("Error running doctor");
    expect(getText(result)).toContain("health check crashed");
  });

  it("returns error when readLockfile throws", async () => {
    vi.mocked(readLockfile).mockImplementation(() => { throw new Error("read fail"); });
    const result = await handleDoctor({});
    expect(getText(result)).toContain("Error running doctor");
  });
});

// ─── handleList ───────────────────────────────────────────────────────────────

describe("handleList()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
  });

  it("returns 'no servers' when lockfile is empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleList({});
    expect(getText(result)).toContain("No MCP servers installed");
  });

  it("lists all installed servers with version, source, and clients", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "server-a": makeLockEntry({ version: "1.0.0", source: "npm", clients: ["claude-desktop"] }),
        "server-b": makeLockEntry({ version: "2.0.0", source: "smithery", clients: ["cursor"] }),
      })
    );
    const result = await handleList({});
    const text = getText(result);
    expect(text).toContain("server-a@1.0.0");
    expect(text).toContain("server-b@2.0.0");
    expect(text).toContain("[npm]");
    expect(text).toContain("[smithery]");
    expect(text).toContain("2 server(s)" + ")" === text ? "" : "");
    expect(text).toContain("Installed MCP servers (2)");
  });

  it("filters servers by client when client arg provided", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "claude-only": makeLockEntry({ clients: ["claude-desktop"] }),
        "cursor-only": makeLockEntry({ clients: ["cursor"] }),
        "both": makeLockEntry({ clients: ["claude-desktop", "cursor"] }),
      })
    );
    const result = await handleList({ client: "cursor" });
    const text = getText(result);
    expect(text).toContain("cursor-only");
    expect(text).toContain("both");
    expect(text).not.toContain("claude-only");
  });

  it("returns client-specific no-results message when filter yields empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "claude-srv": makeLockEntry({ clients: ["claude-desktop"] }) })
    );
    const result = await handleList({ client: "vscode" });
    expect(getText(result)).toContain("vscode");
    expect(getText(result)).toContain("No servers installed");
  });

  it("shows 'none' for clients when clients array is empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "orphan-srv": makeLockEntry({ clients: [] }) })
    );
    const result = await handleList({});
    expect(getText(result)).toContain("clients: none");
  });

  it("shows joined clients list when multiple clients", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "multi-srv": makeLockEntry({ clients: ["claude-desktop", "cursor", "vscode"] }) })
    );
    const result = await handleList({});
    const text = getText(result);
    expect(text).toContain("claude-desktop, cursor, vscode");
  });

  it("returns error when readLockfile throws", async () => {
    vi.mocked(readLockfile).mockImplementation(() => { throw new Error("lockfile missing"); });
    const result = await handleList({});
    expect(getText(result)).toContain("Error listing servers");
    expect(getText(result)).toContain("lockfile missing");
  });
});

// ─── handleInfo ───────────────────────────────────────────────────────────────

describe("handleInfo()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
    vi.mocked(getLockedVersion).mockReset();
    vi.mocked(resolveFromNpm).mockReset();
  });

  it("returns error when 'name' is missing", async () => {
    const result = await handleInfo({});
    expect(getText(result)).toContain("Error");
    expect(getText(result)).toContain("name");
  });

  it("returns error when 'name' is empty string", async () => {
    const result = await handleInfo({ name: "" });
    expect(getText(result)).toContain("Error");
  });

  it("returns installed server info from lockfile", async () => {
    vi.mocked(getLockedVersion).mockReturnValue("1.2.0");
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "test-mcp": makeLockEntry({
          source: "npm",
          runtime: "node",
          command: "npx",
          args: ["-y", "test-mcp@1.2.0"],
          clients: ["claude-desktop"],
          installedAt: "2025-01-01T00:00:00.000Z",
        }),
      })
    );
    const result = await handleInfo({ name: "test-mcp" });
    const text = getText(result);
    expect(text).toContain("test-mcp@1.2.0");
    expect(text).toContain("[installed]");
    expect(text).toContain("Source:");
    expect(text).toContain("Runtime:");
    expect(text).toContain("Command:");
    expect(text).toContain("Clients:");
    expect(text).toContain("Installed:");
  });

  it("shows transport and url when present", async () => {
    vi.mocked(getLockedVersion).mockReturnValue("1.0.0");
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "remote-mcp": makeLockEntry({ transport: "http", url: "https://example.com" }),
      })
    );
    const result = await handleInfo({ name: "remote-mcp" });
    const text = getText(result);
    expect(text).toContain("Transport:");
    expect(text).toContain("URL:");
  });

  it("omits transport and url when absent", async () => {
    vi.mocked(getLockedVersion).mockReturnValue("1.0.0");
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "local-mcp": makeLockEntry() })
    );
    const result = await handleInfo({ name: "local-mcp" });
    const text = getText(result);
    expect(text).not.toContain("Transport:");
    expect(text).not.toContain("URL:");
  });

  it("falls back to npm registry when server not in lockfile", async () => {
    vi.mocked(getLockedVersion).mockReturnValue(undefined);
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    vi.mocked(resolveFromNpm).mockResolvedValue(makeServerMeta({ name: "unknown-mcp", description: "From npm" }));
    const result = await handleInfo({ name: "unknown-mcp" });
    expect(resolveFromNpm).toHaveBeenCalledWith("unknown-mcp");
    const text = getText(result);
    expect(text).toContain("[not installed]");
    expect(text).toContain("From npm");
  });

  it("returns not-found when not in lockfile and npm 404", async () => {
    vi.mocked(getLockedVersion).mockReturnValue(undefined);
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    vi.mocked(resolveFromNpm).mockRejectedValue(new Error("not found on npm"));
    const result = await handleInfo({ name: "ghost-mcp" });
    expect(getText(result)).toContain("not found");
    expect(getText(result)).toContain("ghost-mcp");
  });

  it("returns error on unexpected exception", async () => {
    vi.mocked(readLockfile).mockImplementation(() => { throw new Error("unexpected crash"); });
    const result = await handleInfo({ name: "crash-mcp" });
    expect(getText(result)).toContain("Error fetching info");
    expect(getText(result)).toContain("unexpected crash");
  });

  it("shows 'none' for clients when clients array is empty in lockfile", async () => {
    vi.mocked(getLockedVersion).mockReturnValue("1.0.0");
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "no-client-mcp": makeLockEntry({ clients: [] }) })
    );
    const result = await handleInfo({ name: "no-client-mcp" });
    expect(getText(result)).toContain("none");
  });
});

// ─── handleStatus ─────────────────────────────────────────────────────────────

describe("handleStatus()", () => {
  beforeEach(() => {
    vi.mocked(readLockfile).mockReset();
  });

  it("returns 'no servers' message when lockfile is empty", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleStatus({});
    expect(getText(result)).toContain("No MCP servers installed");
    expect(getText(result)).toContain("mcpman install");
  });

  it("shows total count", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "a": makeLockEntry(),
        "b": makeLockEntry(),
        "c": makeLockEntry(),
      })
    );
    const result = await handleStatus({});
    expect(getText(result)).toContain("Total installed: 3");
  });

  it("aggregates servers by source", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "npm-a": makeLockEntry({ source: "npm" }),
        "npm-b": makeLockEntry({ source: "npm" }),
        "gh-a": makeLockEntry({ source: "github" }),
      })
    );
    const result = await handleStatus({});
    const text = getText(result);
    expect(text).toContain("npm: 2");
    expect(text).toContain("github: 1");
  });

  it("aggregates servers by client", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "srv-a": makeLockEntry({ clients: ["claude-desktop", "cursor"] }),
        "srv-b": makeLockEntry({ clients: ["cursor"] }),
      })
    );
    const result = await handleStatus({});
    const text = getText(result);
    expect(text).toContain("cursor: 2");
    expect(text).toContain("claude-desktop: 1");
  });

  it("shows (none) for clients when no servers have clients", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "orphan": makeLockEntry({ clients: [] }) })
    );
    const result = await handleStatus({});
    expect(getText(result)).toContain("(none)");
  });

  it("shows server list with version", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({
        "server-x": makeLockEntry({ version: "3.0.0" }),
      })
    );
    const result = await handleStatus({});
    expect(getText(result)).toContain("server-x@3.0.0");
  });

  it("includes section headers in output", async () => {
    vi.mocked(readLockfile).mockReturnValue(
      makeLockfile({ "srv": makeLockEntry() })
    );
    const result = await handleStatus({});
    const text = getText(result);
    expect(text).toContain("By source:");
    expect(text).toContain("By client:");
    expect(text).toContain("Server list:");
  });

  it("returns error when readLockfile throws", async () => {
    vi.mocked(readLockfile).mockImplementation(() => { throw new Error("io error"); });
    const result = await handleStatus({});
    expect(getText(result)).toContain("Error fetching status");
    expect(getText(result)).toContain("io error");
  });

  it("ignores extra args (_args is unused)", async () => {
    vi.mocked(readLockfile).mockReturnValue(makeLockfile());
    const result = await handleStatus({ irrelevant: "value", another: 123 });
    expect(getText(result)).toContain("No MCP servers installed");
  });
});
