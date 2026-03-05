/**
 * skill-adapter.ts
 * Parse, validate, and load universal mcpman-skill.json specs.
 */

import fs from "node:fs";
import type { SkillRule, SkillSpec } from "../core/skill-types.js";

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate a parsed SkillSpec object.
 * Throws descriptive errors for missing or invalid required fields.
 */
export function validateSkillSpec(spec: SkillSpec): void {
  if (!spec.name || typeof spec.name !== "string") {
    throw new Error("Skill spec missing required field: name (string)");
  }
  if (!spec.version || typeof spec.version !== "string") {
    throw new Error("Skill spec missing required field: version (string)");
  }
  if (!Array.isArray(spec.rules)) {
    throw new Error("Skill spec missing required field: rules (array)");
  }
  for (let i = 0; i < spec.rules.length; i++) {
    validateSkillRule(spec.rules[i], i);
  }
}

function validateSkillRule(rule: SkillRule, index: number): void {
  if (!rule.name || typeof rule.name !== "string") {
    throw new Error(`Rule at index ${index} missing required field: name (string)`);
  }
  if (typeof rule.content !== "string") {
    throw new Error(`Rule '${rule.name}' missing required field: content (string)`);
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────

/**
 * Parse and validate a raw JSON object as a SkillSpec.
 * Throws if the object doesn't conform to the spec shape.
 */
export function parseSkillSpec(raw: unknown): SkillSpec {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Skill spec must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  const spec: SkillSpec = {
    name: obj.name as string,
    version: obj.version as string,
    description: typeof obj.description === "string" ? obj.description : undefined,
    rules: (Array.isArray(obj.rules) ? obj.rules : []) as SkillRule[],
  };

  if (Array.isArray(obj.mcp_servers)) {
    spec.mcp_servers = obj.mcp_servers as SkillSpec["mcp_servers"];
  }

  validateSkillSpec(spec);
  return spec;
}

/**
 * Load a SkillSpec from a mcpman-skill.json file path.
 * Throws if the file cannot be read or parsed.
 */
export function loadSkillFromFile(filePath: string): SkillSpec {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Cannot read skill file at ${filePath}: ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in skill file at ${filePath}: ${String(err)}`);
  }

  // If stored as an InstalledSkill envelope, extract the nested spec
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "spec" in (parsed as Record<string, unknown>)
  ) {
    parsed = (parsed as Record<string, unknown>).spec;
  }

  return parseSkillSpec(parsed);
}
