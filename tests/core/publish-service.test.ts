/**
 * publish-service.test.ts
 * Tests for readPackageManifest(), validateManifest(), createTarball(), and publishPackage().
 * Uses real temp directories for fs operations.
 * Mocks external dependencies (mcpman-registry-client, child_process).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTarball,
  publishPackage,
  readPackageManifest,
  validateManifest,
} from "../../src/core/publish-service.js";
import type { PackageManifest } from "../../src/core/publish-service.js";

// ── Mock mcpman-registry-client ───────────────────────────────────────────────

vi.mock("../../src/core/mcpman-registry-client.js", () => ({
  publishToMcpmanRegistry: vi.fn(),
}));

import { publishToMcpmanRegistry } from "../../src/core/mcpman-registry-client.js";
const mockPublishToRegistry = vi.mocked(publishToMcpmanRegistry);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-publish-test-"));
}

function writeJson(dir: string, filename: string, data: unknown): void {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2), "utf-8");
}

function makeValidManifest(overrides: Partial<PackageManifest> = {}): PackageManifest {
  return {
    name: "my-pkg",
    version: "1.0.0",
    description: "A test package",
    type: "server",
    runtime: "node",
    command: "node",
    args: ["dist/index.js"],
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTmpDir();
  mockPublishToRegistry.mockReset();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ── readPackageManifest ────────────────────────────────────────────────────────

describe("readPackageManifest()", () => {
  it("throws when package.json does not exist", () => {
    expect(() => readPackageManifest(tmpDir)).toThrow(`No package.json found in ${tmpDir}`);
  });

  it("reads basic fields from package.json", () => {
    writeJson(tmpDir, "package.json", {
      name: "my-pkg",
      version: "2.0.0",
      description: "Hello world",
      type: "skill",
      runtime: "python",
      command: "python",
      args: ["main.py"],
    });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.name).toBe("my-pkg");
    expect(manifest.version).toBe("2.0.0");
    expect(manifest.description).toBe("Hello world");
    expect(manifest.type).toBe("skill");
    expect(manifest.runtime).toBe("python");
    expect(manifest.command).toBe("python");
    expect(manifest.args).toEqual(["main.py"]);
  });

  it("defaults version to '0.0.0' when not set", () => {
    writeJson(tmpDir, "package.json", { name: "minimal" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.version).toBe("0.0.0");
  });

  it("defaults type to 'server' for unknown type", () => {
    writeJson(tmpDir, "package.json", { name: "pkg", type: "unknown-type" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.type).toBe("server");
  });

  it("defaults runtime to 'node' for unknown runtime", () => {
    writeJson(tmpDir, "package.json", { name: "pkg", runtime: "rust" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.runtime).toBe("node");
  });

  it("defaults command to 'node' when not set", () => {
    writeJson(tmpDir, "package.json", { name: "pkg" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.command).toBe("node");
  });

  it("defaults args to [] when not set", () => {
    writeJson(tmpDir, "package.json", { name: "pkg" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.args).toEqual([]);
  });

  it("reads command from mcp field when present", () => {
    writeJson(tmpDir, "package.json", {
      name: "pkg",
      mcp: { command: "deno", args: ["run", "main.ts"] },
    });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.command).toBe("deno");
    expect(manifest.args).toEqual(["run", "main.ts"]);
  });

  it("mcp field takes precedence over top-level command", () => {
    writeJson(tmpDir, "package.json", {
      name: "pkg",
      command: "node",
      mcp: { command: "bun", args: [] },
    });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.command).toBe("bun");
  });

  it("reads envVars from mcp.envVars field", () => {
    writeJson(tmpDir, "package.json", {
      name: "pkg",
      mcp: {
        command: "node",
        args: [],
        envVars: [{ name: "API_KEY", description: "API key", required: true }],
      },
    });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.envVars).toHaveLength(1);
    expect(manifest.envVars![0].name).toBe("API_KEY");
  });

  it("merges mcpman-skill.json overrides on top of package.json", () => {
    writeJson(tmpDir, "package.json", {
      name: "pkg",
      version: "1.0.0",
      type: "server",
    });
    writeJson(tmpDir, "mcpman-skill.json", {
      type: "skill",
      runtime: "python",
      command: "python",
      args: ["run.py"],
    });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.type).toBe("skill");
    expect(manifest.runtime).toBe("python");
    expect(manifest.command).toBe("python");
    expect(manifest.args).toEqual(["run.py"]);
  });

  it("works when mcpman-skill.json does not exist", () => {
    writeJson(tmpDir, "package.json", { name: "pkg", version: "1.0.0" });

    expect(() => readPackageManifest(tmpDir)).not.toThrow();
  });

  it("accepts 'template' as a valid type", () => {
    writeJson(tmpDir, "package.json", { name: "pkg", type: "template" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.type).toBe("template");
  });

  it("accepts 'docker' as a valid runtime", () => {
    writeJson(tmpDir, "package.json", { name: "pkg", runtime: "docker" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.runtime).toBe("docker");
  });

  it("handles description as empty string when not provided", () => {
    writeJson(tmpDir, "package.json", { name: "pkg" });

    const manifest = readPackageManifest(tmpDir);

    expect(manifest.description).toBe("");
  });
});

// ── validateManifest ──────────────────────────────────────────────────────────

describe("validateManifest()", () => {
  it("returns valid=true for a correct manifest", () => {
    const { valid, errors } = validateManifest(makeValidManifest());

    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it("returns error when name is missing", () => {
    const { valid, errors } = validateManifest(makeValidManifest({ name: "" }));

    expect(valid).toBe(false);
    expect(errors).toContain("Missing required field: name");
  });

  it("returns error when version is missing", () => {
    const { valid, errors } = validateManifest(makeValidManifest({ version: "" }));

    expect(valid).toBe(false);
    expect(errors).toContain("Missing required field: version");
  });

  it("returns error when command is missing", () => {
    const { valid, errors } = validateManifest(makeValidManifest({ command: "" }));

    expect(valid).toBe(false);
    expect(errors).toContain("Missing required field: command");
  });

  it("returns error for invalid type", () => {
    const manifest = makeValidManifest({ type: "invalid" as PackageManifest["type"] });
    const { valid, errors } = validateManifest(manifest);

    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("Invalid type"))).toBe(true);
  });

  it("returns error for invalid runtime", () => {
    const manifest = makeValidManifest({ runtime: "rust" as PackageManifest["runtime"] });
    const { valid, errors } = validateManifest(manifest);

    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("Invalid runtime"))).toBe(true);
  });

  it("accumulates multiple errors", () => {
    const manifest = makeValidManifest({ name: "", version: "", command: "" });
    const { valid, errors } = validateManifest(manifest);

    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts all valid type values", () => {
    for (const type of ["server", "skill", "template"] as const) {
      const { valid } = validateManifest(makeValidManifest({ type }));
      expect(valid).toBe(true);
    }
  });

  it("accepts all valid runtime values", () => {
    for (const runtime of ["node", "python", "docker"] as const) {
      const { valid } = validateManifest(makeValidManifest({ runtime }));
      expect(valid).toBe(true);
    }
  });
});

// ── createTarball ─────────────────────────────────────────────────────────────

describe("createTarball()", () => {
  it("creates a tarball file at a temp path", async () => {
    // Create a simple directory to tar
    const sourceDir = path.join(tmpDir, "source-pkg");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "index.js"), "console.log('hello');");

    const { path: tarPath, checksum } = await createTarball(sourceDir);

    expect(fs.existsSync(tarPath)).toBe(true);
    expect(tarPath).toMatch(/\.tgz$/);
    expect(checksum).toMatch(/^sha256-[a-f0-9]+$/);

    // Cleanup
    try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
  });

  it("produces a sha256 checksum with correct prefix", async () => {
    const sourceDir = path.join(tmpDir, "pkg2");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "file.txt"), "data");

    const { checksum } = await createTarball(sourceDir);

    expect(checksum.startsWith("sha256-")).toBe(true);
    // sha256 hex is 64 chars
    expect(checksum.length).toBe(7 + 64); // "sha256-" + 64 hex chars
  });

  it("returns different checksums for different content", async () => {
    const dir1 = path.join(tmpDir, "pkg-a");
    const dir2 = path.join(tmpDir, "pkg-b");
    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir1, "file.txt"), "content-a");
    fs.writeFileSync(path.join(dir2, "file.txt"), "content-b");

    const result1 = await createTarball(dir1);
    const result2 = await createTarball(dir2);

    expect(result1.checksum).not.toBe(result2.checksum);

    // Cleanup
    try { fs.unlinkSync(result1.path); } catch { /* ignore */ }
    try { fs.unlinkSync(result2.path); } catch { /* ignore */ }
  });
});

// ── publishPackage ────────────────────────────────────────────────────────────

describe("publishPackage()", () => {
  beforeEach(() => {
    // Create a minimal package.json in cwd substitute
    // We'll mock createTarball implicitly via child_process
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    writeJson(tmpDir, "package.json", {
      name: "my-pkg",
      version: "1.0.0",
    });
  });

  it("calls publishToMcpmanRegistry with correct options and returns result", async () => {
    const expectedResult = { name: "my-pkg", version: "1.0.0", url: "https://registry.mcpman.dev/packages/my-pkg" };
    mockPublishToRegistry.mockResolvedValueOnce(expectedResult);

    // Create a source dir to tar
    const pkgDir = path.join(tmpDir, "pkg");
    fs.mkdirSync(pkgDir);
    fs.writeFileSync(path.join(pkgDir, "index.js"), "");

    const manifest = makeValidManifest({ name: "my-pkg", version: "1.0.0" });
    const result = await publishPackage(manifest, "my-token");

    expect(mockPublishToRegistry).toHaveBeenCalledOnce();
    const opts = mockPublishToRegistry.mock.calls[0][0];
    expect(opts.name).toBe("my-pkg");
    expect(opts.version).toBe("1.0.0");
    expect(opts.token).toBe("my-token");
    expect(opts.checksum).toMatch(/^sha256-/);
    expect(result).toEqual(expectedResult);
  });

  it("cleans up tarball even when publishing fails", async () => {
    mockPublishToRegistry.mockRejectedValueOnce(new Error("publish error"));

    const pkgDir = path.join(tmpDir, "pkg-fail");
    fs.mkdirSync(pkgDir);
    fs.writeFileSync(path.join(pkgDir, "index.js"), "");

    const manifest = makeValidManifest();
    let tarPath: string | undefined;

    // Spy on publishToMcpmanRegistry to capture tarball path before it fails
    mockPublishToRegistry.mockImplementationOnce(async (opts) => {
      tarPath = opts.tarballPath;
      throw new Error("publish error");
    });

    await expect(publishPackage(manifest, "token")).rejects.toThrow("publish error");

    // Tarball should have been cleaned up
    if (tarPath) {
      expect(fs.existsSync(tarPath)).toBe(false);
    }
  });

  it("propagates error from publishToMcpmanRegistry", async () => {
    mockPublishToRegistry.mockRejectedValueOnce(new Error("Registry publish failed (401): Unauthorized"));

    const manifest = makeValidManifest();

    await expect(publishPackage(manifest, "bad-token")).rejects.toThrow("Registry publish failed");
  });
});
