---
phase: 2
title: New Clients Wave 2 — Codex CLI + OpenCode + Continue + Zed
status: completed
priority: high
estimatedEffort: 2 weeks
blockedBy: [phase-01]
blocks: [phase-04, phase-05]
completedDate: 2026-03-05
---

# Phase 2: New Clients Wave 2 — Codex CLI + OpenCode + Continue + Zed

## Context

- [Config formats reference](../research/researcher-2026-03-05-ai-tool-config-formats.md)
- Phase 1 establishes the pattern; Phase 2 adds 4 more clients

## Overview

Add Codex CLI, OpenCode, Continue, and Zed. Codex CLI requires TOML parsing (new dep: `@iarna/toml`). OpenCode and Continue use YAML (new dep: `yaml`). Zed uses standard JSON.

## Key Insights

### Codex CLI
- **Config:** `~/.codex/config.toml`
- **MCP format:** TOML table `[mcp_servers.name]` with `command`, `args`, `env`
- **Detection:** `~/.codex/` directory exists
- **Challenge:** TOML is not natively supported — need parser

### OpenCode
- **Config:** `~/.config/opencode/config.yaml` or `opencode.yaml` in project
- **MCP format:** `mcpServers:` YAML key with same structure
- **Detection:** `~/.config/opencode/` directory exists

### Continue
- **Config:** `~/.continue/config.yaml` (primary) or `config.json` (legacy)
- **MCP format:** `mcpServers:` YAML list with `name`, `command`, `args`, `env`
- **Detection:** `~/.continue/` directory exists
- **Note:** Continue uses array format, not object — needs adapter

### Zed
- **Config:** `~/.config/zed/settings.json`
- **MCP format:** `{ "context_servers": { "name": { "command": "...", "args": [...] } } }`
- **Detection:** Zed app bundle or `~/.config/zed/` directory
- **Note:** Uses `context_servers` key, not `mcpServers`

## Architecture

### New Dependencies

```json
{
  "dependencies": {
    "@iarna/toml": "^3.0.0",
    "yaml": "^2.7.0"
  }
}
```

### New Files

```
src/clients/
├── codex-cli.ts            # NEW — TOML config handler
├── opencode.ts             # NEW — YAML config handler
├── continue-client.ts      # NEW — YAML with array format
├── zed.ts                  # NEW — JSON with context_servers key

tests/clients/
├── codex-cli.test.ts       # NEW
├── opencode.test.ts        # NEW
├── continue-client.test.ts # NEW
├── zed.test.ts             # NEW
```

### Codex CLI Handler (TOML — custom readRaw/writeRaw)

```typescript
// src/clients/codex-cli.ts
import TOML from "@iarna/toml";
import fs from "node:fs";
import { BaseClientHandler, atomicWrite } from "./base-client-handler.js";
import type { ClientConfig, ClientType, ServerEntry } from "./types.js";

export class CodexCliHandler extends BaseClientHandler {
  type: ClientType = "codex-cli";
  displayName = "Codex CLI";

  getConfigPath(): string {
    return resolveConfigPath("codex-cli");
  }

  // Override readRaw to parse TOML
  protected async readRaw(): Promise<Record<string, unknown>> {
    const configPath = this.getConfigPath();
    try {
      const raw = await fs.promises.readFile(configPath, "utf-8");
      return TOML.parse(raw) as Record<string, unknown>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new ConfigParseError(configPath, err);
    }
  }

  // Override writeRaw to serialize TOML
  protected async writeRaw(data: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath();
    try {
      await atomicWrite(configPath, TOML.stringify(data as TOML.JsonMap));
    } catch (err) {
      throw new ConfigWriteError(configPath, err);
    }
  }

  // TOML uses [mcp_servers.name] tables
  protected toClientConfig(raw: Record<string, unknown>): ClientConfig {
    const mcpServers = (raw.mcp_servers ?? {}) as Record<string, ServerEntry>;
    return { servers: mcpServers };
  }

  protected fromClientConfig(
    raw: Record<string, unknown>,
    config: ClientConfig,
  ): Record<string, unknown> {
    return { ...raw, mcp_servers: config.servers };
  }
}
```

### Continue Handler (YAML array format)

```typescript
// src/clients/continue-client.ts
import YAML from "yaml";
// Continue uses array: mcpServers: [{ name: "x", command: "...", args: [...] }]
// Need to convert to/from Record<string, ServerEntry>

protected toClientConfig(raw: Record<string, unknown>): ClientConfig {
  const mcpArray = (raw.mcpServers ?? []) as Array<{ name: string } & ServerEntry>;
  const servers: Record<string, ServerEntry> = {};
  for (const entry of mcpArray) {
    const { name, ...rest } = entry;
    servers[name] = rest;
  }
  return { servers };
}

protected fromClientConfig(
  raw: Record<string, unknown>,
  config: ClientConfig,
): Record<string, unknown> {
  const mcpArray = Object.entries(config.servers).map(([name, entry]) => ({
    name,
    ...entry,
  }));
  return { ...raw, mcpServers: mcpArray };
}
```

### Zed Handler (context_servers key)

```typescript
// src/clients/zed.ts
protected toClientConfig(raw: Record<string, unknown>): ClientConfig {
  const contextServers = (raw.context_servers ?? {}) as Record<string, ServerEntry>;
  return { servers: contextServers };
}

protected fromClientConfig(
  raw: Record<string, unknown>,
  config: ClientConfig,
): Record<string, unknown> {
  return { ...raw, context_servers: config.servers };
}
```

## Implementation Steps

1. Install dependencies: `npm install @iarna/toml yaml`
2. Update `types.ts` — Add `"codex-cli" | "opencode" | "continue" | "zed"` to ClientType
3. Update `paths.ts` — Add config paths for 4 new clients
4. Create `codex-cli.ts` — TOML handler with custom readRaw/writeRaw
5. Create `opencode.ts` — YAML handler with custom readRaw/writeRaw
6. Create `continue-client.ts` — YAML handler with array-to-map conversion
7. Create `zed.ts` — JSON handler with `context_servers` key
8. Update `client-detector.ts` — Add all 4 to factory
9. Write tests for each handler (4 test files)
10. Update `client-detector.test.ts`
11. Run full test suite (target: 520+ tests)
12. Update docs

## Todo List

- [x] `npm install @iarna/toml yaml`
- [x] Expand ClientType with 4 new values
- [x] Add 4 new paths to resolveConfigPath
- [x] Create codex-cli.ts (TOML handler)
- [x] Create opencode.ts (YAML handler)
- [x] Create continue-client.ts (YAML array handler)
- [x] Create zed.ts (context_servers handler)
- [x] Update client-detector.ts
- [x] Write 4 test files
- [x] Run test suite
- [x] Update docs

## Success Criteria

- [x] `mcpman install --client codex-cli` works with TOML config
- [x] `mcpman install --client opencode` works with YAML config
- [x] `mcpman install --client continue` works with YAML array format
- [x] `mcpman install --client zed` works with context_servers key
- [x] Total 10 clients supported
- [x] 520+ tests passing
- [x] No regressions on existing clients

## Completion Summary

**Phase 2 COMPLETE — 2026-03-05**

Added 4 new AI client handlers bringing total supported clients from 6 to 10. All format adapters implemented correctly, all downstream files updated, code reviewer fixes applied, all tests passing.

**Delivered:**
- `src/clients/codex-cli.ts` — TOML handler via `@iarna/toml`; reads/writes `~/.codex/config.toml` under `[mcp_servers.*]` tables
- `src/clients/opencode.ts` — YAML handler; reads/writes `~/.config/opencode/opencode.json` under `mcpServers:` key; includes guard against empty command
- `src/clients/continue-client.ts` — YAML handler with array↔map conversion; reads/writes `~/.continue/config.yaml`
- `src/clients/zed.ts` — JSON handler using `context_servers` key; reads/writes `~/.config/zed/settings.json`
- 4 new test files (codex-cli.test.ts, opencode.test.ts, continue-client.test.ts, zed.test.ts) with complete coverage
- Updated `client-detector.ts` with all 4 new handlers
- Updated `types.ts` ClientType union with `"codex-cli"`, `"opencode"`, `"continue"`, `"zed"`
- Updated `paths.ts` resolveConfigPath() with all 4 config paths
- New deps: `@iarna/toml ^3.0.0`, `yaml ^2.7.0`
- Code reviewer fixes: config-validator skips non-JSON files; opencode empty command guard; all edge cases handled
- **655 tests passing** (520+ baseline + comprehensive new test coverage)
- Zero regressions on pre-existing 6 clients (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Roo Code)

**Supported Clients:** 10 total
1. Claude Desktop
2. Claude Code CLI
3. Cursor
4. VS Code
5. Windsurf
6. Roo Code
7. Codex CLI (NEW)
8. OpenCode (NEW)
9. Continue (NEW)
10. Zed (NEW)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| @iarna/toml increases bundle size | LOW | LOW | Tree-shake, only imported by codex handler |
| Continue config.yaml format changes | MEDIUM | LOW | Support both array and object format |
| Zed MCP support still experimental | HIGH | LOW | Mark as "beta" in CLI output |
| TOML write may lose comments | MEDIUM | MEDIUM | Preserve raw content, only modify mcp_servers section |
