import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler } from "./base-client-handler.js";
import type { ClientType } from "./types.js";

/**
 * Claude Code CLI stores MCP servers in ~/.claude/.mcp.json (user-level)
 * or .mcp.json (project-level). Uses standard mcpServers format.
 * Format: { "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }
 */
export class ClaudeCodeHandler extends BaseClientHandler {
  type: ClientType = "claude-code";
  displayName = "Claude Code";

  getConfigPath(): string {
    return resolveConfigPath("claude-code");
  }
}
