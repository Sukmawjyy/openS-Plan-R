/**
 * skill-service.test.ts
 * Tests for skill-service.ts CRUD functions and syncSkillsToClient.
 * Uses real temp directories for isolation — no fs mocks needed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installSkill,
  removeSkill,
  listSkills,
  getSkill,
  syncSkillsToClient,
} from "../../src/core/skill-service.js";
import type { SkillSpec, InstalledSkill } from "../../src/core/skill-types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-skill-test-"));
}

function makeSpec(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    name: "test-skill",
    version: "1.0.0",
    rules: [{ name: "rule-one", content: "Always write tests." }],
    ...overrides,
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTmpDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── installSkill ───────────────────────────────────────────────────────────

describe("installSkill()", () => {
  it("creates the skill directory under baseDir", () => {
    const spec = makeSpec();
    installSkill(spec, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "test-skill"))).toBe(true);
  });

  it("writes mcpman-skill.json inside the skill directory", () => {
    const spec = makeSpec();
    installSkill(spec, tmpDir);
    const specFile = path.join(tmpDir, "test-skill", "mcpman-skill.json");
    expect(fs.existsSync(specFile)).toBe(true);
  });

  it("returns an InstalledSkill with correct spec, path, and installedAt", () => {
    const spec = makeSpec();
    const result = installSkill(spec, tmpDir);
    expect(result.spec).toEqual(spec);
    expect(result.path).toBe(path.join(tmpDir, "test-skill"));
    expect(typeof result.installedAt).toBe("string");
    expect(() => new Date(result.installedAt)).not.toThrow();
  });

  it("persists a readable JSON file containing the InstalledSkill envelope", () => {
    const spec = makeSpec();
    installSkill(spec, tmpDir);
    const raw = fs.readFileSync(path.join(tmpDir, "test-skill", "mcpman-skill.json"), "utf-8");
    const parsed = JSON.parse(raw) as InstalledSkill;
    expect(parsed.spec.name).toBe("test-skill");
    expect(parsed.spec.version).toBe("1.0.0");
  });

  it("overwrites an existing installation for the same skill name", () => {
    installSkill(makeSpec({ version: "1.0.0" }), tmpDir);
    installSkill(makeSpec({ version: "2.0.0" }), tmpDir);
    const raw = fs.readFileSync(path.join(tmpDir, "test-skill", "mcpman-skill.json"), "utf-8");
    const parsed = JSON.parse(raw) as InstalledSkill;
    expect(parsed.spec.version).toBe("2.0.0");
  });

  it("normalizes scoped names — @community/react becomes community__react", () => {
    const spec = makeSpec({ name: "@community/react" });
    const result = installSkill(spec, tmpDir);
    expect(result.path).toBe(path.join(tmpDir, "community__react"));
    expect(fs.existsSync(result.path)).toBe(true);
  });

  it("creates parent baseDir if it does not exist", () => {
    const nested = path.join(tmpDir, "sub", "skills");
    const spec = makeSpec();
    installSkill(spec, nested);
    expect(fs.existsSync(path.join(nested, "test-skill"))).toBe(true);
  });
});

// ── removeSkill ────────────────────────────────────────────────────────────

describe("removeSkill()", () => {
  it("returns true and removes the skill directory when skill is installed", () => {
    installSkill(makeSpec(), tmpDir);
    const result = removeSkill("test-skill", tmpDir);
    expect(result).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "test-skill"))).toBe(false);
  });

  it("returns false when skill is not installed", () => {
    const result = removeSkill("nonexistent-skill", tmpDir);
    expect(result).toBe(false);
  });

  it("removes directory recursively — all nested files are deleted", () => {
    installSkill(makeSpec(), tmpDir);
    const skillPath = path.join(tmpDir, "test-skill");
    // Place an extra file inside to confirm recursive removal
    fs.writeFileSync(path.join(skillPath, "extra.txt"), "data");
    removeSkill("test-skill", tmpDir);
    expect(fs.existsSync(skillPath)).toBe(false);
  });

  it("handles scoped skill names correctly", () => {
    const spec = makeSpec({ name: "@org/my-skill" });
    installSkill(spec, tmpDir);
    const result = removeSkill("@org/my-skill", tmpDir);
    expect(result).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "org__my-skill"))).toBe(false);
  });
});

// ── listSkills ─────────────────────────────────────────────────────────────

describe("listSkills()", () => {
  it("returns empty array when baseDir does not exist", () => {
    const missing = path.join(tmpDir, "does-not-exist");
    expect(listSkills(missing)).toEqual([]);
  });

  it("returns empty array when baseDir is empty", () => {
    expect(listSkills(tmpDir)).toEqual([]);
  });

  it("returns a single installed skill", () => {
    installSkill(makeSpec(), tmpDir);
    const skills = listSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].spec.name).toBe("test-skill");
  });

  it("returns all installed skills", () => {
    installSkill(makeSpec({ name: "skill-a" }), tmpDir);
    installSkill(makeSpec({ name: "skill-b" }), tmpDir);
    const skills = listSkills(tmpDir);
    expect(skills).toHaveLength(2);
  });

  it("returns skills sorted alphabetically by spec.name", () => {
    installSkill(makeSpec({ name: "zebra-skill" }), tmpDir);
    installSkill(makeSpec({ name: "alpha-skill" }), tmpDir);
    const skills = listSkills(tmpDir);
    expect(skills[0].spec.name).toBe("alpha-skill");
    expect(skills[1].spec.name).toBe("zebra-skill");
  });

  it("silently skips directories without mcpman-skill.json", () => {
    installSkill(makeSpec(), tmpDir);
    // Create a rogue directory with no spec file
    fs.mkdirSync(path.join(tmpDir, "empty-dir"));
    const skills = listSkills(tmpDir);
    expect(skills).toHaveLength(1);
  });

  it("silently skips directories with corrupt JSON", () => {
    installSkill(makeSpec(), tmpDir);
    // Corrupt the spec of a second skill
    const corruptDir = path.join(tmpDir, "corrupt-skill");
    fs.mkdirSync(corruptDir);
    fs.writeFileSync(path.join(corruptDir, "mcpman-skill.json"), "NOT_JSON");
    const skills = listSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].spec.name).toBe("test-skill");
  });

  it("silently skips plain files at the top level of baseDir", () => {
    installSkill(makeSpec(), tmpDir);
    fs.writeFileSync(path.join(tmpDir, "stray-file.json"), "{}");
    const skills = listSkills(tmpDir);
    expect(skills).toHaveLength(1);
  });
});

// ── getSkill ───────────────────────────────────────────────────────────────

describe("getSkill()", () => {
  it("returns null when skill is not installed", () => {
    const result = getSkill("nonexistent", tmpDir);
    expect(result).toBeNull();
  });

  it("returns the InstalledSkill for an installed skill", () => {
    installSkill(makeSpec(), tmpDir);
    const result = getSkill("test-skill", tmpDir);
    expect(result).not.toBeNull();
    expect(result!.spec.name).toBe("test-skill");
    expect(result!.spec.version).toBe("1.0.0");
  });

  it("returns null when mcpman-skill.json contains invalid JSON", () => {
    const dir = path.join(tmpDir, "broken-skill");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "mcpman-skill.json"), "INVALID_JSON");
    const result = getSkill("broken-skill", tmpDir);
    expect(result).toBeNull();
  });

  it("handles scoped skill name lookup correctly", () => {
    const spec = makeSpec({ name: "@org/my-skill" });
    installSkill(spec, tmpDir);
    const result = getSkill("@org/my-skill", tmpDir);
    expect(result).not.toBeNull();
    expect(result!.spec.name).toBe("@org/my-skill");
  });

  it("returns full rule list from stored spec", () => {
    const spec = makeSpec({
      rules: [
        { name: "rule-one", content: "Content one." },
        { name: "rule-two", content: "Content two." },
      ],
    });
    installSkill(spec, tmpDir);
    const result = getSkill("test-skill", tmpDir);
    expect(result!.spec.rules).toHaveLength(2);
  });
});

// ── syncSkillsToClient ─────────────────────────────────────────────────────

describe("syncSkillsToClient()", () => {
  let cwdTmp: string;

  beforeEach(() => {
    cwdTmp = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("returns empty array when no skills are installed", () => {
    const written = syncSkillsToClient("claude-code", cwdTmp, tmpDir);
    expect(written).toEqual([]);
  });

  it("throws when clientType has no format adapter", () => {
    expect(() => syncSkillsToClient("claude-desktop", cwdTmp, tmpDir)).toThrow(
      /No format adapter available for client/,
    );
  });

  it("writes CLAUDE.md for claude-code client", () => {
    installSkill(makeSpec(), tmpDir);
    const written = syncSkillsToClient("claude-code", cwdTmp, tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(path.join(cwdTmp, "CLAUDE.md"));
    expect(fs.existsSync(written[0])).toBe(true);
  });

  it("CLAUDE.md content includes the rule content", () => {
    installSkill(makeSpec({ rules: [{ name: "my-rule", content: "Do the thing." }] }), tmpDir);
    syncSkillsToClient("claude-code", cwdTmp, tmpDir);
    const content = fs.readFileSync(path.join(cwdTmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("Do the thing.");
    expect(content).toContain("## my-rule");
  });

  it("writes AGENTS.md for codex-cli client", () => {
    installSkill(makeSpec(), tmpDir);
    const written = syncSkillsToClient("codex-cli", cwdTmp, tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(path.join(cwdTmp, "AGENTS.md"));
    expect(fs.existsSync(written[0])).toBe(true);
  });

  it("writes per-rule .mdc files for cursor client", () => {
    const spec = makeSpec({
      rules: [
        { name: "rule-a", content: "Content A." },
        { name: "rule-b", content: "Content B." },
      ],
    });
    installSkill(spec, tmpDir);
    const written = syncSkillsToClient("cursor", cwdTmp, tmpDir);
    expect(written).toHaveLength(2);
    expect(fs.existsSync(path.join(cwdTmp, ".cursor", "rules", "rule-a.mdc"))).toBe(true);
    expect(fs.existsSync(path.join(cwdTmp, ".cursor", "rules", "rule-b.mdc"))).toBe(true);
  });

  it("merges rules from multiple installed skills", () => {
    installSkill(makeSpec({ name: "skill-a", rules: [{ name: "rule-a", content: "A." }] }), tmpDir);
    installSkill(makeSpec({ name: "skill-b", rules: [{ name: "rule-b", content: "B." }] }), tmpDir);
    const written = syncSkillsToClient("claude-code", cwdTmp, tmpDir);
    const content = fs.readFileSync(written[0], "utf-8");
    expect(content).toContain("## rule-a");
    expect(content).toContain("## rule-b");
  });

  it("returns empty array when installed skills have no rules", () => {
    installSkill(makeSpec({ rules: [] }), tmpDir);
    const written = syncSkillsToClient("claude-code", cwdTmp, tmpDir);
    expect(written).toEqual([]);
  });
});
