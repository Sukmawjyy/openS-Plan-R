/**
 * skill-adapter.test.ts
 * Tests for skill-adapter.ts — parsing, validation, and file loading.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseSkillSpec,
  validateSkillSpec,
  loadSkillFromFile,
} from "../../src/adapters/skill-adapter.js";
import type { SkillSpec } from "../../src/core/skill-types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeValidSpec(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    name: "my-skill",
    version: "1.0.0",
    rules: [{ name: "rule-one", content: "Always write tests." }],
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-adapter-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── parseSkillSpec ─────────────────────────────────────────────────────────

describe("parseSkillSpec()", () => {
  it("returns a SkillSpec for a valid raw object", () => {
    const raw = { name: "my-skill", version: "1.0.0", rules: [{ name: "r1", content: "Do X." }] };
    const spec = parseSkillSpec(raw);
    expect(spec.name).toBe("my-skill");
    expect(spec.version).toBe("1.0.0");
    expect(spec.rules).toHaveLength(1);
  });

  it("preserves optional description field", () => {
    const raw = { name: "s", version: "1.0.0", description: "My description", rules: [] };
    // Passes validation only if rules is array (even empty works for parseSkillSpec structure)
    // Note: validateSkillSpec does not require non-empty rules array
    const spec = parseSkillSpec(raw);
    expect(spec.description).toBe("My description");
  });

  it("omits description when not a string", () => {
    const raw = { name: "s", version: "1.0.0", description: 42, rules: [{ name: "r", content: "c" }] };
    const spec = parseSkillSpec(raw);
    expect(spec.description).toBeUndefined();
  });

  it("parses mcp_servers when present as an array", () => {
    const raw = {
      name: "s",
      version: "1.0.0",
      rules: [{ name: "r", content: "c" }],
      mcp_servers: [{ name: "srv", command: "npx", args: ["-y", "srv"] }],
    };
    const spec = parseSkillSpec(raw);
    expect(spec.mcp_servers).toHaveLength(1);
    expect(spec.mcp_servers![0].name).toBe("srv");
  });

  it("omits mcp_servers when not an array", () => {
    const raw = { name: "s", version: "1.0.0", rules: [{ name: "r", content: "c" }], mcp_servers: "not-an-array" };
    const spec = parseSkillSpec(raw);
    expect(spec.mcp_servers).toBeUndefined();
  });

  it("throws when raw is null", () => {
    expect(() => parseSkillSpec(null)).toThrow(/JSON object/);
  });

  it("throws when raw is an array", () => {
    expect(() => parseSkillSpec([])).toThrow(/JSON object/);
  });

  it("throws when raw is a string", () => {
    expect(() => parseSkillSpec("not-an-object")).toThrow(/JSON object/);
  });

  it("throws when raw is a number", () => {
    expect(() => parseSkillSpec(42)).toThrow(/JSON object/);
  });

  it("throws when name is missing", () => {
    const raw = { version: "1.0.0", rules: [{ name: "r", content: "c" }] };
    expect(() => parseSkillSpec(raw)).toThrow(/name/);
  });

  it("throws when version is missing", () => {
    const raw = { name: "s", rules: [{ name: "r", content: "c" }] };
    expect(() => parseSkillSpec(raw)).toThrow(/version/);
  });

  it("normalizes non-array rules to empty array (no throw)", () => {
    // parseSkillSpec coerces non-array rules to [] before calling validateSkillSpec,
    // which accepts an empty array — so no error is thrown.
    const raw = { name: "s", version: "1.0.0", rules: "not-array" };
    const spec = parseSkillSpec(raw);
    expect(spec.rules).toEqual([]);
  });

  it("extracts nested spec from InstalledSkill envelope in loadSkillFromFile", () => {
    // This tests the envelope unwrapping via loadSkillFromFile
    const envelope = {
      spec: { name: "wrapped", version: "2.0.0", rules: [{ name: "r", content: "c" }] },
      installedAt: "2024-01-01T00:00:00.000Z",
      path: "/some/path",
    };
    const filePath = path.join(tmpDir, "mcpman-skill.json");
    fs.writeFileSync(filePath, JSON.stringify(envelope), "utf-8");
    const spec = loadSkillFromFile(filePath);
    expect(spec.name).toBe("wrapped");
    expect(spec.version).toBe("2.0.0");
  });
});

// ── validateSkillSpec ──────────────────────────────────────────────────────

describe("validateSkillSpec()", () => {
  it("does not throw for a valid spec", () => {
    expect(() => validateSkillSpec(makeValidSpec())).not.toThrow();
  });

  it("does not throw for a spec with empty rules array", () => {
    // validateSkillSpec checks rules is array, not that it's non-empty
    const spec = makeValidSpec({ rules: [] });
    expect(() => validateSkillSpec(spec)).not.toThrow();
  });

  it("throws when name is empty string", () => {
    const spec = makeValidSpec({ name: "" });
    expect(() => validateSkillSpec(spec)).toThrow(/name/);
  });

  it("throws when version is empty string", () => {
    const spec = makeValidSpec({ version: "" });
    expect(() => validateSkillSpec(spec)).toThrow(/version/);
  });

  it("throws when rules is not an array (cast scenario)", () => {
    const spec = { ...makeValidSpec(), rules: "not-array" } as unknown as SkillSpec;
    expect(() => validateSkillSpec(spec)).toThrow(/rules/);
  });

  it("throws when a rule is missing its name", () => {
    const spec = makeValidSpec({
      rules: [{ name: "", content: "Some content." }],
    });
    expect(() => validateSkillSpec(spec)).toThrow(/name/);
  });

  it("throws with index info when a rule at index 1 is missing name", () => {
    const spec = makeValidSpec({
      rules: [
        { name: "valid-rule", content: "Content." },
        { name: "", content: "Content." },
      ],
    });
    expect(() => validateSkillSpec(spec)).toThrow(/index 1/);
  });

  it("throws when a rule is missing its content field", () => {
    const spec = makeValidSpec({
      rules: [{ name: "rule-one", content: undefined as unknown as string }],
    });
    expect(() => validateSkillSpec(spec)).toThrow(/content/);
  });

  it("throws when a rule content is not a string", () => {
    const spec = makeValidSpec({
      rules: [{ name: "rule-one", content: 42 as unknown as string }],
    });
    expect(() => validateSkillSpec(spec)).toThrow(/content/);
  });

  it("does not throw for a rule with optional description and globs", () => {
    const spec = makeValidSpec({
      rules: [
        {
          name: "full-rule",
          content: "Do it.",
          description: "A description",
          globs: ["**/*.ts"],
          alwaysApply: true,
        },
      ],
    });
    expect(() => validateSkillSpec(spec)).not.toThrow();
  });
});

// ── loadSkillFromFile ──────────────────────────────────────────────────────

describe("loadSkillFromFile()", () => {
  it("loads a valid skill spec from a plain spec file", () => {
    const spec = makeValidSpec();
    const filePath = path.join(tmpDir, "mcpman-skill.json");
    fs.writeFileSync(filePath, JSON.stringify(spec), "utf-8");
    const loaded = loadSkillFromFile(filePath);
    expect(loaded.name).toBe("my-skill");
    expect(loaded.version).toBe("1.0.0");
    expect(loaded.rules).toHaveLength(1);
  });

  it("loads spec from an InstalledSkill envelope (spec is nested)", () => {
    const envelope = {
      spec: makeValidSpec({ name: "nested-skill" }),
      installedAt: "2024-01-01T00:00:00.000Z",
      path: "/fake/path",
    };
    const filePath = path.join(tmpDir, "mcpman-skill.json");
    fs.writeFileSync(filePath, JSON.stringify(envelope), "utf-8");
    const loaded = loadSkillFromFile(filePath);
    expect(loaded.name).toBe("nested-skill");
  });

  it("throws when file does not exist", () => {
    const missing = path.join(tmpDir, "nonexistent.json");
    expect(() => loadSkillFromFile(missing)).toThrow(/Cannot read skill file/);
  });

  it("throws when file contains invalid JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, "NOT_JSON");
    expect(() => loadSkillFromFile(filePath)).toThrow(/Invalid JSON/);
  });

  it("throws when JSON is valid but spec is invalid (missing name)", () => {
    const filePath = path.join(tmpDir, "invalid-spec.json");
    fs.writeFileSync(filePath, JSON.stringify({ version: "1.0.0", rules: [] }));
    expect(() => loadSkillFromFile(filePath)).toThrow(/name/);
  });

  it("throws when JSON is an array at the top level", () => {
    const filePath = path.join(tmpDir, "array.json");
    fs.writeFileSync(filePath, JSON.stringify([]));
    expect(() => loadSkillFromFile(filePath)).toThrow(/JSON object/);
  });
});
