---
phase: 9
title: Team Collaboration
status: completed
priority: medium
estimatedEffort: 2 weeks
completedDate: 2026-03-05
blockedBy: [phase-01, phase-04]
blocks: [phase-10]
---

# Phase 9: Team Collaboration

## Overview

Shared MCP configs for teams. `.mcpman/team.json` in project root (git-tracked). Team vault, role-based access, audit log.

## Architecture

### Team Config (`.mcpman/team.json`)

```json
{
  "name": "my-team",
  "members": ["alice", "bob"],
  "roles": {
    "alice": "admin",
    "bob": "member"
  },
  "servers": {
    "shared-db": { "command": "...", "args": [...] }
  },
  "skills": ["@team/coding-standards"],
  "vault": "team-vault.enc"
}
```

### Commands

```bash
mcpman team init myteam           # Create team config
mcpman team add alice --role admin # Add member
mcpman team sync                  # Pull team changes
mcpman team share                 # Push local config to team
mcpman team audit                 # Show who changed what
```

### New Files

```
src/commands/team.ts              # NEW
src/core/team-service.ts          # NEW
src/core/team-vault.ts            # NEW — shared encrypted vault
```

## Implementation Steps

1. Define team.json schema
2. Create team-service.ts — init/add/remove/sync logic
3. Create team-vault.ts — shared vault with team password
4. Create team.ts command with subcommands
5. Add audit log (who installed/removed what, when)
6. Role-based permissions (admin: full, member: read + sync)
7. Write tests
8. Update docs

## Todo List

- [ ] Team.json schema
- [ ] Team service
- [ ] Team vault (shared encryption)
- [ ] Team CLI command
- [ ] Audit log
- [ ] Role-based access
- [ ] Write tests (target: 680+ total)
