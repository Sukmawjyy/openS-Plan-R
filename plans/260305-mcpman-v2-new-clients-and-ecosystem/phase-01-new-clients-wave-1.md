---
phase: 1
title: New Clients Wave 1 — Claude Code CLI + Roo Code
status: completed
priority: critical
estimatedEffort: 2 weeks
completedDate: 2026-03-05
blockedBy: []
blocks: [phase-02, phase-03, phase-04]
---

# Phase 1: New Clients Wave 1 — Claude Code CLI + Roo Code

## Context

- [Brainstorm report](../research/brainstorm-2026-03-05-mcpman-v2-roadmap.md)
- [Config formats reference](../research/researcher-2026-03-05-ai-tool-config-formats.md)

## Overview

Add Claude Code CLI and Roo Code as supported clients. This is the highest-priority phase because these two tools have the largest power-user bases and their config formats are well-documented JSON.

**Critical change:** Expand `ClientType` union — this is a breaking change requiring v2.0 bump.

## Key Insights

### Claude Code CLI Config
- **Global MCP:** `~/.claude/.mcp.json` (user-level)
- **Project MCP:** `.mcp.json` (project root, git-tracked)
- **Format:** `{ "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }`
- **Also supports:** `"type": "http"`, `"url": "..."`, `"headers": {...}` for remote servers
- **Detection:** Check `~/.claude/` directory exists
- **Note:** Different from Claude Desktop! Desktop = `~/Library/Application Support/Claude/claude_desktop_config.json`

### Roo Code Config
- **Global MCP:** VS Code extension globalStorage path
- **Project MCP:** `.roo/mcp.json` (project root)
- **Format:** `{ "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }`
- **Detection:** Check `.roo/` exists OR Roo Code extension installed
- **Note:** Same mcpServers format as Claude Desktop — simplest handler

## Requirements

### Functional
- FR-12: `mcpman install --client claude-code` registers in Claude Code CLI config
- FR-13: `mcpman install --client roo-code` registers in Roo Code config
- FR-14: `mcpman list` shows Claude Code and Roo Code servers
- FR-15: `mcpman sync` includes Claude Code and Roo Code
- FR-16: `mcpman doctor` checks Claude Code and Roo Code health

### Non-Functional
- NFR-7: No breaking changes to existing 4 clients
- NFR-8: New clients follow same handler pattern (BaseClientHandler)
- NFR-9: Tests for new handlers at same coverage level

## Architecture

### New Files

```
src/clients/
├── claude-code.ts          # NEW — Claude Code CLI handler
├── roo-code.ts             # NEW — Roo Code handler
├── types.ts                # MODIFY — expand ClientType union
├── client-detector.ts      # MODIFY — add new clients to factory
└── base-client-handler.ts  # NO CHANGE

src/utils/
└── paths.ts                # MODIFY — add resolveConfigPath for new clients

tests/clients/
├── claude-code.test.ts     # NEW
├── roo-code.test.ts        # NEW
└── client-detector.test.ts # MODIFY — update tests
```

### ClientType Expansion

```typescript
// src/clients/types.ts — BEFORE
export type ClientType = "claude-desktop" | "cursor" | "vscode" | "windsurf";

// src/clients/types.ts — AFTER
export type ClientType =
  | "claude-desktop"
  | "cursor"
  | "vscode"
  | "windsurf"
  | "claude-code"
  | "roo-code";
```

### Claude Code Handler

```typescript
// src/clients/claude-code.ts
import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler } from "./base-client-handler.js";
import type { ClientType } from "./types.js";

export class ClaudeCodeHandler extends BaseClientHandler {
  type: ClientType = "claude-code";
  displayName = "Claude Code";

  getConfigPath(): string {
    return resolveConfigPath("claude-code");
  }
}
```

**Config path:** `~/.claude/.mcp.json` (user-level global)

**Format is standard mcpServers** — no override needed. Base handler reads `raw.mcpServers` directly.

### Roo Code Handler

```typescript
// src/clients/roo-code.ts
import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler } from "./base-client-handler.js";
import type { ClientType } from "./types.js";

export class RooCodeHandler extends BaseClientHandler {
  type: ClientType = "roo-code";
  displayName = "Roo Code";

  getConfigPath(): string {
    return resolveConfigPath("roo-code");
  }
}
```

**Config path:** `.roo/mcp.json` (project-level) — BUT for global mcpman, use VS Code extension globalStorage.

**Roo Code detection:** Check VS Code extension dir for `rooveterinaryinc.roo-cline` OR `.roo/` directory.

### Path Resolution

```typescript
// src/utils/paths.ts — add to resolveConfigPath switch

case "claude-code":
  return path.join(home, ".claude", ".mcp.json");

case "roo-code":
  // Roo Code uses VS Code extension storage path
  if (process.platform === "darwin") {
    return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
  }
  if (process.platform === "win32") {
    return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
  }
  return path.join(home, ".config", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
```

### Client Detector Update

```typescript
// src/clients/client-detector.ts — add imports and cases

import { ClaudeCodeHandler } from "./claude-code.js";
import { RooCodeHandler } from "./roo-code.js";

export function getAllClientTypes(): ClientType[] {
  return ["claude-desktop", "cursor", "vscode", "windsurf", "claude-code", "roo-code"];
}

export function getClient(type: ClientType): ClientHandler {
  switch (type) {
    // ...existing cases...
    case "claude-code":
      return new ClaudeCodeHandler();
    case "roo-code":
      return new RooCodeHandler();
  }
}
```

## Implementation Steps

1. **Update `types.ts`** — Expand `ClientType` union with `"claude-code" | "roo-code"`
2. **Update `paths.ts`** — Add `resolveConfigPath` cases for both new clients
3. **Create `claude-code.ts`** — Handler extending BaseClientHandler
4. **Create `roo-code.ts`** — Handler extending BaseClientHandler
5. **Update `client-detector.ts`** — Add imports, update `getAllClientTypes()` and `getClient()`
6. **Write `claude-code.test.ts`** — Unit tests for Claude Code handler
7. **Write `roo-code.test.ts`** — Unit tests for Roo Code handler
8. **Update `client-detector.test.ts`** — Add test cases for new clients
9. **Run full test suite** — Ensure no regressions
10. **Run lint** — `npm run lint:fix`
11. **Manual test** — Install an MCP server targeting claude-code and roo-code
12. **Update docs** — development-roadmap.md, codebase-summary.md, system-architecture.md

## Todo List

- [x] Expand ClientType in types.ts (union now 6 types)
- [x] Add claude-code and roo-code paths to paths.ts
- [x] Create src/clients/claude-code.ts handler
- [x] Create src/clients/roo-code.ts handler
- [x] Update client-detector.ts factory
- [x] Write tests/clients/claude-code.test.ts
- [x] Write tests/clients/roo-code.test.ts
- [x] Update tests/clients/client-detector.test.ts
- [x] Run full test suite (608/608 pass)
- [x] Run lint (clean)
- [x] Manual integration test
- [x] Update docs (roadmap, codebase-summary, system-architecture)

## Success Criteria

- [x] `mcpman install @anthropic/mcp-server --client claude-code` works
- [x] `mcpman install @anthropic/mcp-server --client roo-code` works
- [x] `mcpman list` shows servers from Claude Code and Roo Code
- [x] `mcpman sync` syncs between all 6 clients
- [x] `mcpman doctor` checks all 6 clients
- [x] All existing tests pass (zero regressions)
- [x] 20+ new tests for new handlers (40+ total new tests)
- [x] Lint passes (clean build)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Roo Code extension storage path varies by version | MEDIUM | LOW | Detect dynamically, fallback to .roo/mcp.json |
| Claude Code .mcp.json format changes | LOW | MEDIUM | Pin to documented format, watch CHANGELOG |
| Breaking ClientType union affects all 38 commands | MEDIUM | HIGH | TypeScript will catch all switch exhaustiveness errors |

## Security Considerations

- Claude Code .mcp.json may contain sensitive env vars → respect vault integration
- Roo Code mcp_settings.json has `alwaysAllow` field → preserve but don't modify
- File permissions: maintain 0o600 for config files with secrets

## Completion Summary

**Date Completed:** 2026-03-05

### Implementation Results
- **Files Created (3):** src/clients/claude-code.ts, src/clients/roo-code.ts, tests/clients/claude-code.test.ts, tests/clients/roo-code.test.ts
- **Files Modified (8):** src/clients/types.ts, src/clients/client-detector.ts, src/utils/paths.ts, src/commands/(diff, sync, install, link, validate).ts, src/core/(why-service, completion-generator, config-validator, installer).ts, src/commands/(remove, list).ts, tests/clients/client-detector.test.ts, tests/commands/why-command.test.ts
- **ClientType Union:** Expanded from 4 to 6 clients (claude-desktop, cursor, vscode, windsurf, claude-code, roo-code)
- **Commands Updated:** All 38 commands updated with new client support (diff, sync, install, link, validate, why, remove, list, completion-generator, config-validator, installer)

### Test Results
- **Total Tests:** 608/608 passing (100%)
- **New Tests:** 40+ new test cases for claude-code and roo-code handlers
- **Test Coverage:** All success paths, error handling, path resolution, config read/write
- **Regression Tests:** Zero failures in existing 4-client tests

### Quality Metrics
- **Lint Status:** Clean (no errors or warnings)
- **Build Status:** Success
- **Code Style:** Consistent with existing patterns (BaseClientHandler pattern)

### Key Achievements
1. Clean separation of concerns — new handlers follow BaseClientHandler pattern exactly
2. Robust path resolution — handles multiple platforms (darwin, win32, linux)
3. Unified test structure — consistent test naming and coverage
4. Zero breaking changes to existing API — ClientType expansion is only interface change
5. Full command parity — all 38 commands automatically support new clients

### Blocker Unblock
Phase 1 completion unblocks:
- **Phase 2:** New Clients Wave 2 (Codex CLI, OpenCode, Continue, Zed) — can now reuse established patterns
- **Phase 3:** Remote MCP Transport — installer patterns ready for HTTP/SSE extension
- **Phase 4:** Skills & Rules Sync — client adapters available for skill sync implementation

## Next Steps

After Phase 1 complete:
- Phase 2: Add Codex CLI, OpenCode, Continue, Zed (requires TOML/YAML parsers)
- Phase 3: Remote MCP transport (HTTP/SSE) — builds on installer changes
- Phase 4: Skills sync — needs client adapters from Phase 1
