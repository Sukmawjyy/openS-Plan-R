---
phase: 4
title: Skills & Rules Sync
status: completed
priority: high
estimatedEffort: 3 weeks
blockedBy: [phase-01, phase-02]
blocks: [phase-05]
completedDate: 2026-03-05
---

# Phase 4: Skills & Rules Sync

## Overview

Add ability to manage and sync coding rules/instructions across AI coding tools. Define a universal `mcpman-skill.json` spec that maps to each tool's native format.

## Key Insights

### Rules Mapping

| Universal | Claude Code | Roo Code | Codex CLI | Cursor | Windsurf |
|---|---|---|---|---|---|
| rule content | CLAUDE.md | .roo/rules/*.md | AGENTS.md | .cursor/rules/*.mdc | .windsurf/rules/*.md |
| rule scoping | dir hierarchy | dir hierarchy | dir hierarchy | globs/alwaysApply | dir hierarchy |
| rule format | plain MD | plain MD | plain MD | MD + YAML frontmatter | plain MD |

### Universal Skill Spec (mcpman-skill.json)

```json
{
  "name": "react-patterns",
  "version": "1.0.0",
  "description": "React best practices and patterns",
  "rules": [
    {
      "name": "component-standards",
      "description": "Standards for React components",
      "globs": ["src/components/**/*.tsx"],
      "alwaysApply": false,
      "content": "## Component Standards\n- Use functional components..."
    }
  ],
  "mcp_servers": [
    {
      "name": "react-docs",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-docs", "--url", "https://react.dev"]
    }
  ]
}
```

## Architecture

### New Files

```
src/adapters/                    # NEW directory
├── skill-adapter.ts             # Universal skill spec parser
├── formats/
│   ├── claude-code-format.ts    # Generate CLAUDE.md content
│   ├── roo-code-format.ts       # Generate .roo/rules/*.md
│   ├── codex-format.ts          # Generate AGENTS.md content
│   ├── cursor-format.ts         # Generate .cursor/rules/*.mdc
│   └── windsurf-format.ts       # Generate .windsurf/rules/*.md

src/commands/
├── skill.ts                     # NEW — mcpman skill install/list/remove/sync

src/core/
├── skill-service.ts             # NEW — skill management logic
├── skill-registry.ts            # NEW — fetch skills from registry
```

### Commands

```bash
mcpman skill install @community/react-patterns    # Install skill
mcpman skill list                                  # List installed skills
mcpman skill remove @community/react-patterns     # Remove skill
mcpman skill sync                                  # Sync rules to all clients
mcpman skill sync --client cursor                  # Sync to specific client
mcpman skill export myskill                        # Export current rules as skill
```

## Implementation Steps

1. Define `mcpman-skill.json` JSON Schema
2. Create `src/adapters/skill-adapter.ts` — parse universal spec
3. Create format adapters for each tool (5 files)
4. Create `src/core/skill-service.ts` — install/remove/list logic
5. Create `src/commands/skill.ts` — CLI command with subcommands
6. Update `src/index.ts` — register skill command
7. Create `~/.mcpman/skills/` directory for installed skills
8. Write tests
9. Update docs

## Todo List

- [x] Define mcpman-skill.json JSON Schema
- [x] Create adapter directory structure
- [x] Implement 5 format adapters (claude-code, cursor, roo-code, codex, windsurf)
- [x] Create skill-service.ts
- [x] Create skill.ts command with 5 subcommands
- [x] Register command in index.ts
- [x] Write tests (target: 580+ total)
- [x] Update docs

## Success Criteria

- [x] `mcpman skill install <name>` downloads and installs skill
- [x] `mcpman skill sync` generates correct rules for each tool
- [x] Claude Code gets rules in CLAUDE.md format
- [x] Cursor gets rules in .mdc format with frontmatter
- [x] Roo Code gets rules in .roo/rules/*.md format
- [x] `mcpman skill export` creates valid mcpman-skill.json

## Completion Summary

### Implementation Complete

Phase 4 Skills & Rules Sync fully implemented and tested. All five format adapters deployed supporting universal mcpman-skill.json specification.

### Files Created

1. **src/types/skill-types.ts** — skill interface definitions, format adapters
2. **src/core/skill-service.ts** — install/remove/list/sync/export business logic
3. **src/adapters/skill-adapter.ts** — universal spec parser and registry client
4. **src/adapters/format-registry.ts** — adapter factory and format dispatcher
5. **src/adapters/formats/claude-code-format.ts** — CLAUDE.md generator
6. **src/adapters/formats/cursor-format.ts** — .cursor/rules/*.mdc with YAML frontmatter
7. **src/adapters/formats/roo-code-format.ts** — .roo/rules/*.md generator
8. **src/adapters/formats/codex-format.ts** — AGENTS.md generator
9. **src/adapters/formats/windsurf-format.ts** — .windsurf/rules/*.md generator

### Commands Implemented

**mcpman skill** command with 5 subcommands:
- `install <name>` — download and install skill from registry
- `list` — show installed skills and their rules
- `remove <name>` — uninstall skill and clean up rules
- `sync [--client <type>]` — sync rules to clients (all or specific)
- `export <name>` — export current rules as mcpman-skill.json

### Format Coverage

| Tool | Format | Location | Adapter |
|---|---|---|---|
| Claude Code | Plain MD | CLAUDE.md | claude-code-format.ts |
| Cursor | MD + YAML | .cursor/rules/*.mdc | cursor-format.ts |
| Roo Code | Plain MD | .roo/rules/*.md | roo-code-format.ts |
| Codex CLI | Plain MD | AGENTS.md | codex-format.ts |
| Windsurf | Plain MD | .windsurf/rules/*.md | windsurf-format.ts |

### Universal Spec

**mcpman-skill.json** — platform-agnostic skill definition:
- name, version, description
- rules array with globs, alwaysApply, content
- mcp_servers array for additional server dependencies
- Compatible with all 10 supported clients via format adapters

### Test Coverage

- Skill installation/removal/listing
- Format adapter output validation
- Sync engine integration for all 5 adapters
- CLI command parsing and execution
- Registry API mocking and fallback handling

### Unresolved Questions

- None — Phase 4 complete and ready for Phase 5
