/**
 * types.ts
 * JSON Schema definitions for MCP tool input parameters.
 * Each schema describes the expected arguments for a mcpman MCP tool.
 */

/** Install a MCP server by name with optional client and transport URL */
export const installSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Server package name (npm, smithery, or GitHub URL)" },
    client: { type: "string", description: "Target client type (e.g. claude-code, cursor)" },
    url: { type: "string", description: "Remote server URL for HTTP/SSE transport" },
  },
  required: ["name"],
};

/** Remove a MCP server by name (requires --allow-write on serve) */
export const removeSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Server name to remove from lockfile" },
  },
  required: ["name"],
};

/** List installed MCP servers, optionally filtered by client */
export const listSchema = {
  type: "object",
  properties: {
    client: { type: "string", description: "Filter servers for a specific client" },
  },
  required: [],
};

/** Search registries for MCP servers */
export const searchSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search query string" },
    limit: { type: "number", description: "Maximum number of results (default: 10, max: 100)", minimum: 1, maximum: 100 },
  },
  required: ["query"],
};

/** Run a security audit on installed servers */
export const auditSchema = {
  type: "object",
  properties: {
    server: { type: "string", description: "Specific server to audit (omit for all)" },
  },
  required: [],
};

/** Run health diagnostics on installed servers */
export const doctorSchema = {
  type: "object",
  properties: {
    server: { type: "string", description: "Specific server to diagnose (omit for all)" },
  },
  required: [],
};

/** Get detailed information about a specific server */
export const infoSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Server package name" },
  },
  required: ["name"],
};

/** Get aggregated status summary of installed servers */
export const statusSchema = {
  type: "object",
  properties: {},
  required: [],
};
