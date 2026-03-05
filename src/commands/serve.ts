/**
 * serve.ts
 * CLI command to start mcpman as an MCP server over stdio.
 * Enables AI agents (Claude Code, Roo Code, Codex CLI) to manage MCP servers
 * programmatically via mcpman_install, mcpman_list, mcpman_search, etc.
 *
 * Usage:
 *   mcpman serve
 *   mcpman serve --allow-write   # Enable destructive operations (remove)
 *
 * Register in .mcp.json:
 *   { "mcpServers": { "mcpman": { "command": "npx", "args": ["mcpman", "serve"] } } }
 */

import { defineCommand } from "citty";
import { startMcpServer } from "../mcp-server/server.js";
import { setWriteEnabled } from "../mcp-server/tools-registry.js";
import { error } from "../utils/logger.js";

export default defineCommand({
  meta: {
    name: "serve",
    description: "Start mcpman as an MCP server (stdio transport) for AI agent use",
  },
  args: {
    "allow-write": {
      type: "boolean",
      description: "Enable write operations (remove) — disabled by default for safety",
      default: false,
    },
  },
  async run({ args }) {
    if (args["allow-write"]) {
      setWriteEnabled(true);
    }
    try {
      await startMcpServer();
    } catch (err) {
      error(`Failed to start MCP server: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  },
});
