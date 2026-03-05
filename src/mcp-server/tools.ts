/**
 * tools.ts
 * Barrel re-export for all MCP tool handlers.
 */

export { handleInstall, handleRemove, handleSearch } from "./tools-registry.js";
export { handleAudit, handleDoctor } from "./tools-diagnostics.js";
export { handleList, handleInfo, handleStatus } from "./tools-query.js";
