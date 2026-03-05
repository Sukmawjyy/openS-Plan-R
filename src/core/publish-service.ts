/**
 * publish-service.ts
 * Package manifest reading, validation, tarball creation, and registry publishing.
 * Reads package.json + optional mcpman-skill.json to build a PackageManifest.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { EnvVarSpec } from "./registry.js";
import {
  type PublishOptions,
  type PublishResult,
  publishToMcpmanRegistry,
} from "./mcpman-registry-client.js";

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  type: "server" | "skill" | "template";
  runtime: "node" | "python" | "docker";
  command: string;
  args: string[];
  envVars?: EnvVarSpec[];
}

const VALID_TYPES = new Set(["server", "skill", "template"]);
const VALID_RUNTIMES = new Set(["node", "python", "docker"]);

// ── Manifest reading ──────────────────────────────────────────────────────────

/** Read PackageManifest from package.json (required) + mcpman-skill.json (optional override). */
export function readPackageManifest(dir?: string): PackageManifest {
  const cwd = dir ?? process.cwd();

  // Read package.json
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`No package.json found in ${cwd}`);
  }
  const pkgRaw = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;

  // Optional mcpman-skill.json overrides
  const skillPath = path.join(cwd, "mcpman-skill.json");
  const skill: Record<string, unknown> = fs.existsSync(skillPath)
    ? (JSON.parse(fs.readFileSync(skillPath, "utf-8")) as Record<string, unknown>)
    : {};

  const merged = { ...pkgRaw, ...skill };
  const mcpField =
    merged.mcp && typeof merged.mcp === "object" ? (merged.mcp as Record<string, unknown>) : {};

  const name = String(merged.name ?? "");
  const version = String(merged.version ?? "0.0.0");
  const description = String(merged.description ?? "");
  const type = VALID_TYPES.has(String(merged.type)) ? (String(merged.type) as PackageManifest["type"]) : "server";
  const runtime = VALID_RUNTIMES.has(String(merged.runtime ?? "node"))
    ? (String(merged.runtime ?? "node") as PackageManifest["runtime"])
    : "node";
  const command = String(mcpField.command ?? merged.command ?? "node");
  const args = Array.isArray(mcpField.args ?? merged.args)
    ? ((mcpField.args ?? merged.args) as string[])
    : [];
  const envVars = Array.isArray(mcpField.envVars) ? (mcpField.envVars as EnvVarSpec[]) : undefined;

  return { name, version, description, type, runtime, command, args, envVars };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateManifest(manifest: PackageManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest.name) errors.push("Missing required field: name");
  if (!manifest.version) errors.push("Missing required field: version");
  if (!VALID_TYPES.has(manifest.type)) {
    errors.push(`Invalid type '${manifest.type}'. Must be: server | skill | template`);
  }
  if (!VALID_RUNTIMES.has(manifest.runtime)) {
    errors.push(`Invalid runtime '${manifest.runtime}'. Must be: node | python | docker`);
  }
  if (!manifest.command) errors.push("Missing required field: command");

  return { valid: errors.length === 0, errors };
}

// ── Tarball creation ──────────────────────────────────────────────────────────

/**
 * Create a tarball of the given directory.
 * Uses the native tar command available on all platforms we support.
 * Returns the temp path and sha256 checksum.
 */
export async function createTarball(dir: string): Promise<{ path: string; checksum: string }> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const tarPath = path.join(os.tmpdir(), `mcpman-publish-${Date.now()}.tgz`);

  await execFileAsync("tar", ["-czf", tarPath, "-C", path.dirname(dir), path.basename(dir)]);

  const buf = fs.readFileSync(tarPath);
  const checksum = `sha256-${createHash("sha256").update(buf).digest("hex")}`;

  return { path: tarPath, checksum };
}

// ── Publishing ────────────────────────────────────────────────────────────────

/** Full publish flow: build tarball, then POST to registry. */
export async function publishPackage(
  manifest: PackageManifest,
  token: string,
): Promise<PublishResult> {
  const { path: tarballPath, checksum } = await createTarball(process.cwd());

  const opts: PublishOptions = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    type: manifest.type,
    runtime: manifest.runtime,
    command: manifest.command,
    args: manifest.args,
    tarballPath,
    checksum,
    token,
  };

  try {
    return await publishToMcpmanRegistry(opts);
  } finally {
    // Clean up temp tarball
    try {
      fs.unlinkSync(tarballPath);
    } catch {
      /* best-effort cleanup */
    }
  }
}
