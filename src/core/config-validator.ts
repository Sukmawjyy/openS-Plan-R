/**
 * config-validator.ts
 * Validates lockfile JSON schema and client MCP config files.
 */

import fs from "node:fs";
import { resolveConfigPath } from "../utils/paths.js";
import { resolveLockfilePath } from "./lockfile.js";
import type { LockEntry, LockfileData } from "./lockfile.js";

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
}

// ── Lockfile validation ────────────────────────────────────────────────────────

const REQUIRED_LOCK_FIELDS: (keyof LockEntry)[] = ["version", "source", "command", "args"];
const VALID_SOURCES = ["npm", "smithery", "github", "local"] as const;
const VALID_TRANSPORTS = ["stdio", "http", "sse"] as const;

/** Validate lockfile JSON schema at given path (defaults to resolved path) */
export function validateLockfile(filePath?: string): ValidationResult {
  const target = filePath ?? resolveLockfilePath();
  const errors: string[] = [];

  if (!fs.existsSync(target)) {
    return { file: target, valid: false, errors: ["Lockfile not found"] };
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(target, "utf-8"));
  } catch {
    return { file: target, valid: false, errors: ["Invalid JSON"] };
  }

  if (typeof data !== "object" || data === null) {
    return { file: target, valid: false, errors: ["Root must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.lockfileVersion !== 1) {
    errors.push(`lockfileVersion must be 1, got ${JSON.stringify(obj.lockfileVersion)}`);
  }

  if (typeof obj.servers !== "object" || obj.servers === null || Array.isArray(obj.servers)) {
    errors.push("servers must be an object");
    return { file: target, valid: errors.length === 0, errors };
  }

  const servers = obj.servers as Record<string, unknown>;
  for (const [name, entry] of Object.entries(servers)) {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`servers.${name}: must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    for (const field of REQUIRED_LOCK_FIELDS) {
      if (!(field in e)) {
        errors.push(`servers.${name}: missing required field "${field}"`);
      }
    }
    if (e.source && !VALID_SOURCES.includes(e.source as (typeof VALID_SOURCES)[number])) {
      errors.push(`servers.${name}: invalid source "${e.source}"`);
    }
    if (!Array.isArray(e.args)) {
      errors.push(`servers.${name}: args must be an array`);
    }
    if (
      e.transport &&
      !VALID_TRANSPORTS.includes(e.transport as (typeof VALID_TRANSPORTS)[number])
    ) {
      errors.push(`servers.${name}: invalid transport "${e.transport}"`);
    }
  }

  return { file: target, valid: errors.length === 0, errors };
}

// ── Client config validation ───────────────────────────────────────────────────

type KnownClient =
  | "claude-desktop"
  | "cursor"
  | "vscode"
  | "windsurf"
  | "claude-code"
  | "roo-code"
  | "codex-cli"
  | "opencode"
  | "continue"
  | "zed";

// Clients whose config is not JSON — skip JSON-based validation
const NON_JSON_CLIENTS: ReadonlySet<string> = new Set(["codex-cli", "continue"]);

/** Validate a client's MCP config JSON. Checks mcpServers entries have command+args. */
export function validateClientConfig(clientName: string): ValidationResult {
  let filePath: string;
  try {
    filePath = resolveConfigPath(clientName as KnownClient);
  } catch {
    return { file: clientName, valid: false, errors: [`Unknown client: ${clientName}`] };
  }

  // TOML/YAML configs can't be validated with JSON.parse — skip
  if (NON_JSON_CLIENTS.has(clientName)) {
    if (!fs.existsSync(filePath)) {
      return { file: filePath, valid: false, errors: ["Config file not found"] };
    }
    return { file: filePath, valid: true, errors: [] };
  }

  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    return { file: filePath, valid: false, errors: ["Config file not found"] };
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { file: filePath, valid: false, errors: ["Invalid JSON"] };
  }

  if (typeof data !== "object" || data === null) {
    return { file: filePath, valid: false, errors: ["Root must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  // Handle VS Code: mcpServers may be under "mcpServers" or "mcp.servers"
  const servers = (obj.mcpServers ?? (obj as Record<string, unknown>)["mcp.servers"]) as
    | Record<string, unknown>
    | undefined;

  if (!servers) {
    // No servers key — not necessarily invalid (client may have no MCP config yet)
    return { file: filePath, valid: true, errors: [] };
  }

  if (typeof servers !== "object" || Array.isArray(servers)) {
    errors.push("mcpServers must be an object");
    return { file: filePath, valid: false, errors };
  }

  for (const [name, entry] of Object.entries(servers)) {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`mcpServers.${name}: must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    const isRemote = e.type === "http" || e.type === "sse" || typeof e.url === "string";
    if (isRemote) {
      if (!e.url || typeof e.url !== "string") {
        errors.push(`mcpServers.${name}: remote entry missing "url"`);
      }
    } else {
      if (!("command" in e) || typeof e.command !== "string") {
        errors.push(`mcpServers.${name}: missing or invalid "command"`);
      }
      if (!("args" in e) || !Array.isArray(e.args)) {
        errors.push(`mcpServers.${name}: missing or invalid "args" (must be array)`);
      }
    }
  }

  return { file: filePath, valid: errors.length === 0, errors };
}

/** Validate both lockfile and all detected client configs */
export function validateAll(lockfilePath?: string): ValidationResult[] {
  const results: ValidationResult[] = [validateLockfile(lockfilePath)];
  const clients: KnownClient[] = [
    "claude-desktop",
    "cursor",
    "vscode",
    "windsurf",
    "claude-code",
    "roo-code",
    "codex-cli",
    "opencode",
    "continue",
    "zed",
  ];
  for (const client of clients) {
    const r = validateClientConfig(client);
    // Only include if file exists (skip missing client configs)
    if (!r.errors.includes("Config file not found")) {
      results.push(r);
    }
  }
  return results;
}
