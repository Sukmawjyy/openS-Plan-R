import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler } from "./base-client-handler.js";
import type { ClientType } from "./types.js";

/**
 * Roo Code (formerly Roo Cline) stores MCP servers in its VS Code extension
 * globalStorage at mcp_settings.json. Uses standard mcpServers format.
 * Format: { "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }
 */
export class RooCodeHandler extends BaseClientHandler {
  type: ClientType = "roo-code";
  displayName = "Roo Code";

  getConfigPath(): string {
    return resolveConfigPath("roo-code");
  }
}
