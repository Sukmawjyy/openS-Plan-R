---
phase: 5
title: Agent Config Sync — Full Definition
status: completed
priority: high
estimatedEffort: 3 weeks
completedDate: 2026-03-05
blockedBy: [phase-04]
blocks: [phase-06]
---

# Phase 5: Agent Config Sync — Full Agent Definition

## Overview

Extend skills sync to include full agent/mode definitions. Sync agent name, description, tools, model preferences, system prompt, and permission mode across tools.

## Key Insights

### Agent Format Mapping

| Universal | Claude Code | Roo Code | Codex CLI |
|---|---|---|---|
| Agent definition | `.claude/agents/*.md` (YAML frontmatter) | `.roomodes` (YAML customModes) | `AGENTS.md` + `[agents]` TOML |
| Name | `name:` frontmatter | `slug:` + `name:` | Implicit (file section) |
| Description | `description:` | `description:` | Prose in AGENTS.md |
| Tools | `tools:` list | `groups:` array | N/A |
| Model | `model: sonnet\|opus\|haiku` | Per-mode API config | `model` in config.toml |
| System prompt | Markdown body | `roleDefinition:` | Markdown body |
| Permissions | `permissionMode:` | File regex in groups | `sandbox_mode:` |

### Universal Agent Spec (in mcpman-skill.json)

```json
{
  "agents": [
    {
      "name": "code-reviewer",
      "description": "Reviews code quality",
      "role": "You are a senior code reviewer...",
      "tools": ["Read", "Glob", "Grep"],
      "deniedTools": ["Write", "Edit"],
      "model": "fast",
      "filePatterns": ["*.ts", "*.tsx"],
      "instructions": "Focus on TypeScript best practices"
    }
  ]
}
```

## Architecture

### New Files

```
src/adapters/formats/
├── claude-code-agent-format.ts   # Generate .claude/agents/*.md
├── roo-code-agent-format.ts      # Generate .roomodes entries
├── codex-agent-format.ts         # Generate AGENTS.md sections

src/core/
├── agent-service.ts              # NEW — agent sync logic

src/commands/
├── agent.ts                      # NEW — mcpman agent sync/list/export
```

### Commands

```bash
mcpman agent sync                 # Sync agents across all tools
mcpman agent sync --client roo-code  # Sync to specific tool
mcpman agent list                 # List configured agents
mcpman agent export               # Export agents as universal spec
```

## Implementation Steps

1. Define agent schema in mcpman-skill.json spec
2. Create Claude Code agent format adapter (YAML frontmatter in .md)
3. Create Roo Code agent format adapter (.roomodes YAML)
4. Create Codex CLI agent format adapter (AGENTS.md markdown)
5. Create agent-service.ts
6. Create agent.ts command
7. Handle tool mapping differences (Claude tools → Roo groups → Codex implicit)
8. Handle model mapping (sonnet/opus/haiku → tool-specific model IDs)
9. Write tests
10. Update docs

## Todo List

- [x] Define agent schema
- [x] Create 3 agent format adapters
- [x] Create agent-service.ts
- [x] Create agent.ts command
- [x] Implement tool mapping layer
- [x] Implement model mapping layer
- [x] Write tests (844 total, 49 tests)
- [x] Update docs

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tool lists don't map 1:1 | HIGH | MEDIUM | Use common subset + warn on unmappable tools |
| Model names differ per platform | HIGH | LOW | Map to abstract tiers: fast/balanced/powerful |
| Roo Code modes have features agents don't | MEDIUM | LOW | Preserve Roo-specific fields in passthrough |
