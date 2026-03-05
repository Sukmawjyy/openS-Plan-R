/**
 * team-service.test.ts
 * Tests for team collaboration CRUD operations in team-service.ts.
 * Uses real temp directories for file isolation — no fs mocks needed.
 * Mocks lockfile module for syncTeamToLocal and shareLocalToTeam.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock lockfile ─────────────────────────────────────────────────────────────

vi.mock("../../src/core/lockfile.js", () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

import { readLockfile, writeLockfile } from "../../src/core/lockfile.js";
const mockReadLockfile = vi.mocked(readLockfile);
const mockWriteLockfile = vi.mocked(writeLockfile);

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  AUDIT_FILE,
  TEAM_DIR,
  TEAM_FILE,
  addMember,
  addTeamServer,
  getAuditLog,
  initTeam,
  readTeamConfig,
  removeMember,
  removeTeamServer,
  shareLocalToTeam,
  syncTeamToLocal,
  writeTeamConfig,
} from "../../src/core/team-service.js";
import type { TeamConfig, TeamServerEntry } from "../../src/core/team-types.js";
import type { LockfileData, LockEntry } from "../../src/core/lockfile.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-team-test-"));
}

function makeLockEntry(overrides: Partial<LockEntry> = {}): LockEntry {
  return {
    version: "1.0.0",
    source: "npm",
    resolved: "https://registry.npmjs.org/server",
    integrity: "sha512-xxx",
    runtime: "node",
    command: "npx",
    args: ["-y", "server"],
    envVars: [],
    installedAt: new Date().toISOString(),
    clients: [],
    ...overrides,
  };
}

function makeLockfile(servers: Record<string, LockEntry> = {}): LockfileData {
  return { lockfileVersion: 1, servers };
}

function makeServerEntry(overrides: Partial<TeamServerEntry> = {}): TeamServerEntry {
  return {
    command: "npx",
    args: ["-y", "my-server"],
    ...overrides,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTmpDir();
  vi.clearAllMocks();
  mockReadLockfile.mockReturnValue(makeLockfile());
  mockWriteLockfile.mockReturnValue(undefined);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// ── readTeamConfig / writeTeamConfig ──────────────────────────────────────────

describe("readTeamConfig()", () => {
  it("returns null when team.json does not exist", () => {
    const result = readTeamConfig(tmpDir);
    expect(result).toBeNull();
  });

  it("returns TeamConfig when team.json exists", () => {
    const config: TeamConfig = {
      name: "my-team",
      members: [{ name: "alice", role: "admin", addedAt: new Date().toISOString() }],
      servers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mcpmanDir = path.join(tmpDir, TEAM_DIR);
    fs.mkdirSync(mcpmanDir, { recursive: true });
    fs.writeFileSync(path.join(mcpmanDir, TEAM_FILE), JSON.stringify(config), "utf-8");

    const result = readTeamConfig(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-team");
    expect(result!.members).toHaveLength(1);
  });

  it("returns null when team.json contains invalid JSON", () => {
    const mcpmanDir = path.join(tmpDir, TEAM_DIR);
    fs.mkdirSync(mcpmanDir, { recursive: true });
    fs.writeFileSync(path.join(mcpmanDir, TEAM_FILE), "NOT JSON", "utf-8");

    const result = readTeamConfig(tmpDir);

    expect(result).toBeNull();
  });
});

describe("writeTeamConfig()", () => {
  it("creates .mcpman directory if it does not exist", () => {
    const config: TeamConfig = {
      name: "t",
      members: [],
      servers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeTeamConfig(config, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, TEAM_DIR))).toBe(true);
  });

  it("writes valid JSON to team.json", () => {
    const config: TeamConfig = {
      name: "test-team",
      members: [],
      servers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeTeamConfig(config, tmpDir);

    const raw = fs.readFileSync(path.join(tmpDir, TEAM_DIR, TEAM_FILE), "utf-8");
    const parsed = JSON.parse(raw) as TeamConfig;
    expect(parsed.name).toBe("test-team");
  });

  it("updates updatedAt timestamp on write", () => {
    const oldTime = "2020-01-01T00:00:00.000Z";
    const config: TeamConfig = {
      name: "t",
      members: [],
      servers: {},
      createdAt: oldTime,
      updatedAt: oldTime,
    };

    writeTeamConfig(config, tmpDir);

    const raw = fs.readFileSync(path.join(tmpDir, TEAM_DIR, TEAM_FILE), "utf-8");
    const parsed = JSON.parse(raw) as TeamConfig;
    expect(parsed.updatedAt).not.toBe(oldTime);
  });

  it("uses atomic write (no leftover .tmp file)", () => {
    const config: TeamConfig = {
      name: "t",
      members: [],
      servers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeTeamConfig(config, tmpDir);

    const tmpFile = path.join(tmpDir, TEAM_DIR, `${TEAM_FILE}.tmp`);
    expect(fs.existsSync(tmpFile)).toBe(false);
  });
});

// ── initTeam ──────────────────────────────────────────────────────────────────

describe("initTeam()", () => {
  it("creates a new team config with the given name", () => {
    const config = initTeam("my-team", tmpDir);

    expect(config.name).toBe("my-team");
  });

  it("adds current OS user as admin member", () => {
    const config = initTeam("my-team", tmpDir);

    expect(config.members).toHaveLength(1);
    expect(config.members[0].role).toBe("admin");
    expect(config.members[0].name).toBe(os.userInfo().username);
  });

  it("creates team.json file on disk", () => {
    initTeam("my-team", tmpDir);

    expect(fs.existsSync(path.join(tmpDir, TEAM_DIR, TEAM_FILE))).toBe(true);
  });

  it("initializes with empty servers object", () => {
    const config = initTeam("my-team", tmpDir);

    expect(config.servers).toEqual({});
  });

  it("creates audit log entry for init", () => {
    initTeam("my-team", tmpDir);

    const log = getAuditLog(tmpDir);
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].action).toBe("add_member");
    expect(log[0].details).toBe("init");
  });

  it("sets createdAt and updatedAt timestamps", () => {
    const before = new Date();
    const config = initTeam("my-team", tmpDir);
    const after = new Date();

    const createdAt = new Date(config.createdAt);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ── addMember ─────────────────────────────────────────────────────────────────

describe("addMember()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
  });

  it("adds a new member with specified role", () => {
    addMember("bob", "member", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const bob = config.members.find((m) => m.name === "bob");
    expect(bob).toBeDefined();
    expect(bob!.role).toBe("member");
  });

  it("adds viewer role member", () => {
    addMember("carol", "viewer", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const carol = config.members.find((m) => m.name === "carol");
    expect(carol!.role).toBe("viewer");
  });

  it("updates existing member role instead of adding duplicate", () => {
    addMember("bob", "member", tmpDir);
    addMember("bob", "admin", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const bobs = config.members.filter((m) => m.name === "bob");
    expect(bobs).toHaveLength(1);
    expect(bobs[0].role).toBe("admin");
  });

  it("throws when team config not found", () => {
    expect(() => addMember("bob", "member", path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });

  it("records add_member audit entry", () => {
    const auditBefore = getAuditLog(tmpDir).length;
    addMember("dave", "member", tmpDir);
    const auditAfter = getAuditLog(tmpDir);

    expect(auditAfter.length).toBeGreaterThan(auditBefore);
    const entry = auditAfter[auditAfter.length - 1];
    expect(entry.action).toBe("add_member");
    expect(entry.target).toBe("dave");
  });

  it("adds addedAt timestamp to new member", () => {
    addMember("eve", "member", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const eve = config.members.find((m) => m.name === "eve");
    expect(typeof eve!.addedAt).toBe("string");
    expect(() => new Date(eve!.addedAt)).not.toThrow();
  });
});

// ── removeMember ──────────────────────────────────────────────────────────────

describe("removeMember()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
    addMember("bob", "member", tmpDir);
  });

  it("removes an existing member", () => {
    removeMember("bob", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.members.find((m) => m.name === "bob")).toBeUndefined();
  });

  it("does not affect other members when removing one", () => {
    addMember("carol", "viewer", tmpDir);
    const countBefore = readTeamConfig(tmpDir)!.members.length;

    removeMember("bob", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.members.length).toBe(countBefore - 1);
    expect(config.members.find((m) => m.name === "carol")).toBeDefined();
  });

  it("is a no-op for non-existent member (no error thrown)", () => {
    expect(() => removeMember("nonexistent-user", tmpDir)).not.toThrow();
  });

  it("records remove_member audit entry", () => {
    const auditBefore = getAuditLog(tmpDir).length;
    removeMember("bob", tmpDir);
    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(auditBefore);
    const lastEntry = log[log.length - 1];
    expect(lastEntry.action).toBe("remove_member");
    expect(lastEntry.target).toBe("bob");
  });

  it("throws when team config not found", () => {
    expect(() => removeMember("bob", path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });
});

// ── addTeamServer ─────────────────────────────────────────────────────────────

describe("addTeamServer()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
  });

  it("adds a server to the team config", () => {
    addTeamServer("my-server", makeServerEntry(), tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["my-server"]).toBeDefined();
  });

  it("stores server entry with command and args", () => {
    const entry = makeServerEntry({ command: "python", args: ["server.py"] });
    addTeamServer("python-server", entry, tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["python-server"].command).toBe("python");
    expect(config.servers["python-server"].args).toEqual(["server.py"]);
  });

  it("stores HTTP server entry with url and type", () => {
    const entry: TeamServerEntry = { type: "http", url: "https://example.com/mcp" };
    addTeamServer("remote-server", entry, tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["remote-server"].type).toBe("http");
    expect(config.servers["remote-server"].url).toBe("https://example.com/mcp");
  });

  it("overwrites existing server entry", () => {
    addTeamServer("server", makeServerEntry({ command: "old" }), tmpDir);
    addTeamServer("server", makeServerEntry({ command: "new" }), tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["server"].command).toBe("new");
  });

  it("can add multiple servers", () => {
    addTeamServer("server-a", makeServerEntry(), tmpDir);
    addTeamServer("server-b", makeServerEntry(), tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(Object.keys(config.servers)).toHaveLength(2);
  });

  it("records add_server audit entry", () => {
    const auditBefore = getAuditLog(tmpDir).length;
    addTeamServer("my-server", makeServerEntry(), tmpDir);
    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(auditBefore);
    const lastEntry = log[log.length - 1];
    expect(lastEntry.action).toBe("add_server");
    expect(lastEntry.target).toBe("my-server");
  });

  it("throws when team config not found", () => {
    expect(() => addTeamServer("s", makeServerEntry(), path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });
});

// ── removeTeamServer ──────────────────────────────────────────────────────────

describe("removeTeamServer()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
    addTeamServer("my-server", makeServerEntry(), tmpDir);
  });

  it("removes an existing server", () => {
    removeTeamServer("my-server", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["my-server"]).toBeUndefined();
  });

  it("does not affect other servers when removing one", () => {
    addTeamServer("other-server", makeServerEntry(), tmpDir);
    removeTeamServer("my-server", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["other-server"]).toBeDefined();
  });

  it("is a no-op for non-existent server", () => {
    expect(() => removeTeamServer("nonexistent-server", tmpDir)).not.toThrow();
  });

  it("records remove_server audit entry", () => {
    const auditBefore = getAuditLog(tmpDir).length;
    removeTeamServer("my-server", tmpDir);
    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(auditBefore);
    const lastEntry = log[log.length - 1];
    expect(lastEntry.action).toBe("remove_server");
    expect(lastEntry.target).toBe("my-server");
  });

  it("throws when team config not found", () => {
    expect(() => removeTeamServer("s", path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });
});

// ── syncTeamToLocal ───────────────────────────────────────────────────────────

describe("syncTeamToLocal()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
  });

  it("throws when team config not found", () => {
    expect(() => syncTeamToLocal(path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });

  it("returns empty result when team has no servers", () => {
    mockReadLockfile.mockReturnValue(makeLockfile());

    const result = syncTeamToLocal(tmpDir);

    expect(result.added).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("adds new server to lockfile (not in local)", () => {
    addTeamServer("new-server", makeServerEntry({ command: "npx", args: ["-y", "new-server"] }), tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile()); // empty local lockfile

    const result = syncTeamToLocal(tmpDir);

    expect(result.added).toContain("new-server");
    expect(result.updated).not.toContain("new-server");
  });

  it("updates existing server in lockfile", () => {
    addTeamServer("existing-server", makeServerEntry(), tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile({
      "existing-server": makeLockEntry(),
    }));

    const result = syncTeamToLocal(tmpDir);

    expect(result.updated).toContain("existing-server");
    expect(result.added).not.toContain("existing-server");
  });

  it("calls writeLockfile after sync", () => {
    addTeamServer("s1", makeServerEntry(), tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile());

    syncTeamToLocal(tmpDir);

    expect(mockWriteLockfile).toHaveBeenCalledOnce();
  });

  it("records sync audit entry", () => {
    mockReadLockfile.mockReturnValue(makeLockfile());

    const auditBefore = getAuditLog(tmpDir).length;
    syncTeamToLocal(tmpDir);
    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(auditBefore);
    const lastEntry = log[log.length - 1];
    expect(lastEntry.action).toBe("sync");
  });

  it("uses url as resolved when entry has url", () => {
    addTeamServer("remote", { type: "http", url: "https://example.com/mcp" }, tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile());

    syncTeamToLocal(tmpDir);

    const writtenData = mockWriteLockfile.mock.calls[0][0] as LockfileData;
    expect(writtenData.servers["remote"].resolved).toBe("https://example.com/mcp");
    expect(writtenData.servers["remote"].transport).toBe("http");
  });

  it("sets version to 'team' for synced entries", () => {
    addTeamServer("s", makeServerEntry(), tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile());

    syncTeamToLocal(tmpDir);

    const writtenData = mockWriteLockfile.mock.calls[0][0] as LockfileData;
    expect(writtenData.servers["s"].version).toBe("team");
  });

  it("sets source to 'local' for synced entries", () => {
    addTeamServer("s", makeServerEntry(), tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile());

    syncTeamToLocal(tmpDir);

    const writtenData = mockWriteLockfile.mock.calls[0][0] as LockfileData;
    expect(writtenData.servers["s"].source).toBe("local");
  });
});

// ── shareLocalToTeam ──────────────────────────────────────────────────────────

describe("shareLocalToTeam()", () => {
  beforeEach(() => {
    initTeam("my-team", tmpDir);
  });

  it("throws when team config not found", () => {
    mockReadLockfile.mockReturnValue(makeLockfile());
    expect(() => shareLocalToTeam(["s"], path.join(tmpDir, "empty"))).toThrow(
      "Team config not found",
    );
  });

  it("adds local server to team config", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "local-server": makeLockEntry({ command: "npx", args: ["-y", "local-server"] }),
    }));

    shareLocalToTeam(["local-server"], tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["local-server"]).toBeDefined();
    expect(config.servers["local-server"].command).toBe("npx");
  });

  it("silently skips servers not in lockfile", () => {
    mockReadLockfile.mockReturnValue(makeLockfile());

    expect(() => shareLocalToTeam(["nonexistent"], tmpDir)).not.toThrow();

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["nonexistent"]).toBeUndefined();
  });

  it("shares multiple servers at once", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "s1": makeLockEntry({ command: "cmd1", args: [] }),
      "s2": makeLockEntry({ command: "cmd2", args: [] }),
    }));

    shareLocalToTeam(["s1", "s2"], tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["s1"]).toBeDefined();
    expect(config.servers["s2"]).toBeDefined();
  });

  it("records share audit entry", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "shared-server": makeLockEntry(),
    }));

    const auditBefore = getAuditLog(tmpDir).length;
    shareLocalToTeam(["shared-server"], tmpDir);
    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(auditBefore);
    const lastEntry = log[log.length - 1];
    expect(lastEntry.action).toBe("share");
    expect(lastEntry.target).toContain("shared-server");
  });

  it("preserves transport and url from local entry", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "http-server": makeLockEntry({ transport: "http", url: "https://example.com/mcp" }),
    }));

    shareLocalToTeam(["http-server"], tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["http-server"].type).toBe("http");
    expect(config.servers["http-server"].url).toBe("https://example.com/mcp");
  });

  it("omits command when local entry has empty command", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "no-cmd-server": makeLockEntry({ command: "", args: [], transport: "http", url: "https://x.com" }),
    }));

    shareLocalToTeam(["no-cmd-server"], tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["no-cmd-server"].command).toBeUndefined();
  });

  it("omits args when local entry has empty args", () => {
    mockReadLockfile.mockReturnValue(makeLockfile({
      "no-args-server": makeLockEntry({ command: "cmd", args: [] }),
    }));

    shareLocalToTeam(["no-args-server"], tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["no-args-server"].args).toBeUndefined();
  });
});

// ── getAuditLog ───────────────────────────────────────────────────────────────

describe("getAuditLog()", () => {
  it("returns empty array when audit file does not exist", () => {
    const log = getAuditLog(tmpDir);
    expect(log).toEqual([]);
  });

  it("returns audit entries after initTeam", () => {
    initTeam("my-team", tmpDir);

    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThan(0);
  });

  it("returns empty array when audit file contains invalid JSON", () => {
    const mcpmanDir = path.join(tmpDir, TEAM_DIR);
    fs.mkdirSync(mcpmanDir, { recursive: true });
    fs.writeFileSync(path.join(mcpmanDir, AUDIT_FILE), "NOT JSON");

    const log = getAuditLog(tmpDir);

    expect(log).toEqual([]);
  });

  it("entries have required timestamp, actor, action, target fields", () => {
    initTeam("my-team", tmpDir);

    const log = getAuditLog(tmpDir);

    expect(log[0].timestamp).toBeDefined();
    expect(typeof log[0].timestamp).toBe("string");
    expect(log[0].actor).toBeDefined();
    expect(log[0].action).toBeDefined();
    expect(log[0].target).toBeDefined();
  });

  it("accumulates entries across operations", () => {
    initTeam("my-team", tmpDir);
    addMember("bob", "member", tmpDir);
    addTeamServer("server-a", makeServerEntry(), tmpDir);

    const log = getAuditLog(tmpDir);

    expect(log.length).toBeGreaterThanOrEqual(3);
  });

  it("operations maintain chronological audit order", () => {
    initTeam("my-team", tmpDir);
    addMember("bob", "member", tmpDir);

    const log = getAuditLog(tmpDir);

    // Later entries have later or equal timestamps
    const t0 = new Date(log[0].timestamp).getTime();
    const t1 = new Date(log[1].timestamp).getTime();
    expect(t1).toBeGreaterThanOrEqual(t0);
  });
});

// ── Permission checks (admin-only operations by convention) ───────────────────

describe("Permission validation (admin role enforcement)", () => {
  it("initTeam always grants admin role to the first member", () => {
    const config = initTeam("secure-team", tmpDir);

    expect(config.members[0].role).toBe("admin");
  });

  it("addMember with 'admin' role creates an admin member", () => {
    initTeam("my-team", tmpDir);
    addMember("super-user", "admin", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const member = config.members.find((m) => m.name === "super-user");
    expect(member!.role).toBe("admin");
  });

  it("addMember with 'viewer' role creates a viewer member", () => {
    initTeam("my-team", tmpDir);
    addMember("read-only-user", "viewer", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    const member = config.members.find((m) => m.name === "read-only-user");
    expect(member!.role).toBe("viewer");
  });

  it("updating existing member to viewer demotes them", () => {
    initTeam("my-team", tmpDir);
    addMember("user", "admin", tmpDir);
    addMember("user", "viewer", tmpDir); // demote

    const config = readTeamConfig(tmpDir)!;
    const member = config.members.find((m) => m.name === "user");
    expect(member!.role).toBe("viewer");
  });

  it("updating existing member to admin promotes them", () => {
    initTeam("my-team", tmpDir);
    addMember("user", "member", tmpDir);
    addMember("user", "admin", tmpDir); // promote

    const config = readTeamConfig(tmpDir)!;
    const member = config.members.find((m) => m.name === "user");
    expect(member!.role).toBe("admin");
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("initTeam is idempotent — second call overwrites existing config", () => {
    initTeam("team-v1", tmpDir);
    initTeam("team-v2", tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.name).toBe("team-v2");
  });

  it("team config with skills field is preserved after write", () => {
    const config: TeamConfig = {
      name: "t",
      members: [],
      servers: {},
      skills: ["@org/my-skill"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeTeamConfig(config, tmpDir);

    const read = readTeamConfig(tmpDir)!;
    expect(read.skills).toEqual(["@org/my-skill"]);
  });

  it("addTeamServer with env variables stores them", () => {
    initTeam("t", tmpDir);
    addTeamServer("env-server", { command: "node", env: { API_KEY: "${MY_KEY}" } }, tmpDir);

    const config = readTeamConfig(tmpDir)!;
    expect(config.servers["env-server"].env?.API_KEY).toBe("${MY_KEY}");
  });

  it("syncTeamToLocal with env variables maps to envVars keys", () => {
    initTeam("t", tmpDir);
    addTeamServer("s", { command: "node", args: [], env: { KEY1: "v1", KEY2: "v2" } }, tmpDir);
    mockReadLockfile.mockReturnValue(makeLockfile());

    syncTeamToLocal(tmpDir);

    const writtenData = mockWriteLockfile.mock.calls[0][0] as LockfileData;
    expect(writtenData.servers["s"].envVars).toContain("KEY1");
    expect(writtenData.servers["s"].envVars).toContain("KEY2");
  });

  it("handles team name with special characters", () => {
    const config = initTeam("my team / org", tmpDir);
    expect(config.name).toBe("my team / org");
  });
});
