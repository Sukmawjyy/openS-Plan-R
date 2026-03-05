/**
 * format-registry.ts
 * Maps ClientType values to their corresponding format adapter.
 * Clients that don't support file-based rules (e.g. claude-desktop, vscode)
 * return null — rule syncing is not applicable for them.
 *
 * Uses static imports so getFormatAdapter() can be called synchronously.
 */

import type { ClientType } from "../clients/types.js";
import type { SkillRule } from "../core/skill-types.js";
import * as claudeCodeFormat from "./formats/claude-code-format.js";
import * as codexFormat from "./formats/codex-format.js";
import * as cursorFormat from "./formats/cursor-format.js";
import * as rooCodeFormat from "./formats/roo-code-format.js";
import * as windsurfFormat from "./formats/windsurf-format.js";

/** Common interface all format adapters satisfy */
export interface FormatAdapter {
  formatRules(rules: SkillRule[]): Array<{ filename: string; content: string }>;
}

/** Clients that support file-based rule syncing */
const SUPPORTED_CLIENTS = new Set<ClientType>([
  "claude-code",
  "cursor",
  "roo-code",
  "codex-cli",
  "windsurf",
]);

/** Returns true if the client supports rule file syncing */
export function clientSupportsRules(clientType: ClientType): boolean {
  return SUPPORTED_CLIENTS.has(clientType);
}

/**
 * Returns the format adapter for a given client type, or null if the client
 * does not support file-based rule syncing.
 */
export function getFormatAdapter(clientType: ClientType): FormatAdapter | null {
  switch (clientType) {
    case "claude-code":
      return claudeCodeFormat;

    case "cursor":
      return cursorFormat;

    case "roo-code":
      return rooCodeFormat;

    case "codex-cli":
      return codexFormat;

    case "windsurf":
      return windsurfFormat;

    // Clients without file-based rule support
    case "claude-desktop":
    case "vscode":
    case "opencode":
    case "continue":
    case "zed":
      return null;
  }
}
