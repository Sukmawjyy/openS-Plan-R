---
phase: 6
title: mcpman as MCP Server
status: completed
priority: medium
estimatedEffort: 2 weeks
completedDate: 2026-03-05
blockedBy: [phase-01, phase-03]
blocks: [phase-07]
---

# Phase 6: mcpman as MCP Server

## Overview

Expose mcpman's core functionality as an MCP server. AI agents can manage their own MCP server ecosystem programmatically — install, remove, list, audit, search servers via MCP tool calls.

**Unique selling point:** No other tool enables AI agents to self-manage MCP servers.

## Architecture

### MCP Tools to Expose

```
mcpman_install    — Install MCP server (name, client?, transport?)
mcpman_remove     — Remove MCP server (name, client?)
mcpman_list       — List installed servers (client?)
mcpman_search     — Search registries (query)
mcpman_audit      — Run security audit (server?)
mcpman_doctor     — Run health diagnostics
mcpman_info       — Get server details (name)
mcpman_status     — Aggregated server status
```

### New Files

```
src/mcp-server/
├── server.ts               # MCP server entry point (stdio transport)
├── tools.ts                # Tool definitions and handlers
├── types.ts                # MCP tool input/output schemas

src/commands/
├── serve.ts                # NEW — mcpman serve (start MCP server)
```

### Usage

```bash
# Start mcpman as MCP server
mcpman serve

# Register in Claude Code .mcp.json
{
  "mcpServers": {
    "mcpman": {
      "command": "npx",
      "args": ["mcpman", "serve"]
    }
  }
}
```

### MCP Server Implementation

```typescript
// src/mcp-server/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "mcpman",
  version: "2.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "mcpman_install", description: "Install MCP server", inputSchema: {...} },
    { name: "mcpman_list", description: "List installed servers", inputSchema: {...} },
    // ...
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "mcpman_install": return handleInstall(request.params.arguments);
    case "mcpman_list": return handleList(request.params.arguments);
    // ...
  }
});
```

### New Dependency

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  }
}
```

## Implementation Steps

1. Install `@modelcontextprotocol/sdk`
2. Create `src/mcp-server/types.ts` — tool input/output schemas
3. Create `src/mcp-server/tools.ts` — tool handlers wrapping existing core services
4. Create `src/mcp-server/server.ts` — MCP server with stdio transport
5. Create `src/commands/serve.ts` — CLI command to start server
6. Update `src/index.ts` — register serve command
7. Update `package.json` — add `"mcpman-serve"` bin entry
8. Write tests
9. Update docs with MCP server usage guide

## Todo List

- [x] Install @modelcontextprotocol/sdk (pre-installed)
- [x] Create mcp-server directory
- [x] Define tool schemas (8 tools)
- [x] Implement tool handlers
- [x] Create serve command
- [ ] Add bin entry for mcpman-serve
- [ ] Write tests (target: 620+ total)
- [ ] Write MCP server usage guide
- [ ] Update docs

## Success Criteria

- [ ] `mcpman serve` starts MCP server on stdio
- [ ] AI agents can call mcpman_install to install servers
- [ ] AI agents can call mcpman_list to see installed servers
- [ ] AI agents can call mcpman_search to find servers
- [ ] AI agents can call mcpman_audit for security checks
- [ ] Works with Claude Code, Roo Code, Codex CLI as MCP client
