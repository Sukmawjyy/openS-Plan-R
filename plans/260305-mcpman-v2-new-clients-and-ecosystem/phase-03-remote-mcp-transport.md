---
phase: 3
title: Remote MCP Transport — HTTP/SSE Support
status: completed
priority: high
estimatedEffort: 2 weeks
blockedBy: [phase-01]
blocks: [phase-06]
completedDate: 2026-03-05
---

# Phase 3: Remote MCP Transport — HTTP/SSE Support

## Overview

Add support for HTTP (Streamable HTTP) and SSE (Server-Sent Events) MCP server transport. Currently mcpman only handles stdio servers (`command` + `args`). Remote servers use `url` + optional `headers`/`auth`.

## Key Insights

- Streamable HTTP is the recommended transport for cloud MCP servers (replacing SSE)
- Claude Code, Codex CLI already support HTTP transport natively
- ServerEntry needs expansion: `type?: "stdio" | "http" | "sse"`, `url?`, `headers?`

## Architecture

### ServerEntry Expansion

```typescript
// src/clients/types.ts — expanded
export interface ServerEntry {
  // stdio transport (existing)
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // remote transport (NEW)
  type?: "stdio" | "http" | "sse";
  url?: string;
  headers?: Record<string, string>;
}
```

### New Core Module

```
src/core/
├── remote-installer.ts     # NEW — HTTP/SSE server registration
├── remote-health-checker.ts # NEW — HTTP endpoint health check
```

### New Commands

```bash
# Install remote server
mcpman install --url https://api.example.com/mcp/ --name my-remote
mcpman install --url https://sse.example.com/events --transport sse --name my-sse

# Health check remote server
mcpman doctor my-remote
mcpman test my-remote  # JSON-RPC over HTTP
```

## Implementation Steps

1. Expand `ServerEntry` interface with `type`, `url`, `headers` fields
2. Create `remote-installer.ts` — resolve URL, validate endpoint, register
3. Update `installer.ts` — detect `--url` flag, delegate to remote installer
4. Create `remote-health-checker.ts` — HTTP GET/POST health check
5. Update `health-checker.ts` — route to remote checker for HTTP/SSE entries
6. Update `mcp-tester.ts` — JSON-RPC test over HTTP (POST with Content-Type)
7. Update `lockfile.ts` — store transport type in lockfile entries
8. Update `sync-engine.ts` — sync remote servers across clients
9. Write tests
10. Update docs

## Completion Summary

Phase 3 implementation complete. Remote MCP transport (HTTP/SSE) fully operational across all mcpman commands and clients.

### New Modules Created
- `src/core/remote-installer.ts` — HTTP/SSE server registration + URL validation
- `src/core/remote-health-checker.ts` — HTTP endpoint health checks + status resolution

### Updated Modules
- `src/clients/types.ts` — ServerEntry expanded: `type?: "stdio" | "http" | "sse"`, `url?`, `headers?`
- `src/core/installer.ts` — `--url` flag detection, delegates to remote installer
- `src/core/health-checker.ts` — routes HTTP/SSE entries to remote health checker
- `src/core/mcp-tester.ts` — JSON-RPC POST over HTTP, Content-Type application/json
- `src/core/lockfile.ts` — transport type persisted in lockfile entries
- `src/core/sync-engine.ts` — multi-client sync supports remote servers
- `src/commands/test-command.ts` — remote server testing
- `src/commands/list.ts` — shows transport type (stdio/http/sse) per server
- `src/core/config-diff.ts` — drift detection includes remote entries
- `src/core/config-validator.ts` — schema validates new transport fields

### Test Coverage
- 725/725 tests passing
- 70 new tests for remote transport
- HTTP endpoint mocking, URL validation, SSE parsing

## Success Criteria

- [x] `mcpman install --url https://example.com/mcp/ --name my-server` works
- [x] Remote servers appear in `mcpman list` with transport indicator
- [x] `mcpman doctor` checks HTTP endpoint availability
- [x] `mcpman test` validates JSON-RPC over HTTP
- [x] Remote servers sync across clients that support HTTP transport
- [x] 725/725 tests pass (no regressions)
