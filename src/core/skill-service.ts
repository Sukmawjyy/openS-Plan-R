/**
 * skill-service.ts
 * Manages installed skills stored at ~/.mcpman/skills/{name}/mcpman-skill.json.
 * Provides install, remove, list, get, and syncSkillsToClient operations.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFormatAdapter } from "../adapters/format-registry.js";
import type { ClientType } from "../clients/types.js";
import type { InstalledSkill, SkillSpec } from "./skill-types.js";

// ── Paths ──────────────────────────────────────────────────────────────────

/** Returns ~/.mcpman/skills directory */
export function getSkillsDir(): string {
  return path.join(os.homedir(), ".mcpman", "skills");
}

/** Returns the directory for a specific installed skill */
function skillDir(name: string, baseDir = getSkillsDir()): string {
  // Normalize scoped names: @community/react → community__react
  const safeName = name.replace(/^@/, "").replace(/\//g, "__");
  return path.join(baseDir, safeName);
}

/** Returns the mcpman-skill.json path inside a skill directory */
function skillSpecPath(name: string, baseDir = getSkillsDir()): string {
  return path.join(skillDir(name, baseDir), "mcpman-skill.json");
}

// ── Core CRUD ──────────────────────────────────────────────────────────────

/**
 * Install a skill by saving its spec to disk.
 * Overwrites any existing installation for the same name.
 */
export function installSkill(spec: SkillSpec, baseDir = getSkillsDir()): InstalledSkill {
  const dir = skillDir(spec.name, baseDir);
  fs.mkdirSync(dir, { recursive: true });

  const installedAt = new Date().toISOString();
  const installed: InstalledSkill = { spec, installedAt, path: dir };

  fs.writeFileSync(
    path.join(dir, "mcpman-skill.json"),
    JSON.stringify(installed, null, 2),
    "utf-8",
  );

  return installed;
}

/**
 * Remove an installed skill by name.
 * Returns true if removed, false if not found.
 */
export function removeSkill(name: string, baseDir = getSkillsDir()): boolean {
  const dir = skillDir(name, baseDir);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/**
 * List all installed skills.
 * Silently skips corrupt or missing spec files.
 */
export function listSkills(baseDir = getSkillsDir()): InstalledSkill[] {
  if (!fs.existsSync(baseDir)) return [];

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const skills: InstalledSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const specFile = path.join(baseDir, entry.name, "mcpman-skill.json");
    try {
      const raw = fs.readFileSync(specFile, "utf-8");
      const data = JSON.parse(raw) as InstalledSkill;
      skills.push(data);
    } catch {
      // Skip corrupt entries
    }
  }

  return skills.sort((a, b) => a.spec.name.localeCompare(b.spec.name));
}

/**
 * Get a specific installed skill by name.
 * Returns null if not found or spec is unreadable.
 */
export function getSkill(name: string, baseDir = getSkillsDir()): InstalledSkill | null {
  const specFile = skillSpecPath(name, baseDir);
  if (!fs.existsSync(specFile)) return null;

  try {
    const raw = fs.readFileSync(specFile, "utf-8");
    return JSON.parse(raw) as InstalledSkill;
  } catch {
    return null;
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────

/**
 * Sync all installed skill rules to a specific client.
 * Collects rules from every installed skill, runs them through the
 * appropriate format adapter, and writes output files to cwd.
 *
 * @returns Array of file paths that were written
 */
export function syncSkillsToClient(
  clientType: ClientType,
  cwd = process.cwd(),
  baseDir = getSkillsDir(),
): string[] {
  const adapter = getFormatAdapter(clientType);
  if (!adapter) {
    throw new Error(`No format adapter available for client: ${clientType}`);
  }

  const skills = listSkills(baseDir);
  const allRules = skills.flatMap((s) => s.spec.rules);

  if (allRules.length === 0) return [];

  const outputs = adapter.formatRules(allRules);
  const written: string[] = [];

  for (const { filename, content } of outputs) {
    const dest = path.join(cwd, filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
    written.push(dest);
  }

  return written;
}
