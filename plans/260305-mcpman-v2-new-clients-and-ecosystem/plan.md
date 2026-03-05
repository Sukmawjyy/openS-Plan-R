---
title: mcpman v2.0 — New Clients & Ecosystem Expansion
status: completed
priority: high
created: 2026-03-05
estimatedEffort: 16 weeks
completedOn: 2026-03-05
blockedBy: []
blocks: []
---

# mcpman v2.0 — New Clients & Ecosystem Expansion

## Overview

Expand mcpman from 4 clients to 10+, add skills/agent config sync, remote MCP transport, own registry, embedded dashboard, team collaboration, and MCP server mode. Major version bump (v2.0) allows breaking changes.

## Key Decisions

| Decision | Choice |
|---|---|
| Spec format | JSON |
| TOML parser | @iarna/toml |
| Registry backend | Cloudflare Workers + D1/R2 |
| Dashboard | Embedded in CLI |
| Agent sync | Full definition |
| MCP server mode | Yes |
| Versioning | v2.0 major bump |

## Phases

| # | Phase | Status | Est. | File |
|---|---|---|---|---|
| 1 | New Clients Wave 1 (Claude Code + Roo Code) | completed | 2w | phase-01-new-clients-wave-1.md |
| 2 | New Clients Wave 2 (Codex CLI + OpenCode + Continue + Zed) | completed | 2w | phase-02-new-clients-wave-2.md |
| 3 | Remote MCP Transport (HTTP/SSE) | completed | 2w | phase-03-remote-mcp-transport.md |
| 4 | Skills & Rules Sync | completed | 3w | phase-04-skills-and-rules-sync.md |
| 5 | Agent Config Sync | completed | 3w | phase-05-agent-config-sync.md |
| 6 | mcpman as MCP Server | completed | 2w | phase-06-mcpman-mcp-server.md |
| 7 | Registry & Marketplace | completed | 3w | phase-07-registry-and-marketplace.md |
| 8 | Embedded Dashboard | completed | 3w | phase-08-embedded-dashboard.md |
| 9 | Team Collaboration | completed | 2w | phase-09-team-collaboration.md |
| 10 | v2.0 Release & GTM | completed | 1w | phase-10-release-and-gtm.md |
| **Overall Progress** | | **100%** | **24w** | **All 10 phases complete** |

## Dependencies

```
Phase 1 → Phase 2 (client architecture established)
Phase 1 → Phase 3 (transport extends installer)
Phase 1 → Phase 4 (skills need client adapters)
Phase 4 → Phase 5 (agent sync builds on skill sync)
Phase 1-5 → Phase 6 (MCP server exposes existing commands)
Phase 1-6 → Phase 7 (registry indexes all features)
Phase 1-6 → Phase 8 (dashboard visualizes all features)
Phase 1-8 → Phase 9 (team features span everything)
Phase 1-9 → Phase 10 (release)
```

## Major Achievements

**Client Support (10 new types)**
- Phase 1: Claude Code CLI, Roo Code
- Phase 2: Codex CLI, OpenCode, Continue, Zed
- Total: 10 new client handlers + original 4 = 14 supported clients

**Infrastructure**
- Phase 3: HTTP/SSE remote transport for distributed MCP
- Phase 4: Skills & Rules sync system for collaborative development
- Phase 5: Full agent config sync with definitions
- Phase 6: mcpman as standalone MCP Server (8 tools, modularized)

**Platform Features**
- Phase 7: Registry & Marketplace (mcpman registry client, publish service)
- Phase 8: Embedded HTTP Dashboard (7 endpoints)
- Phase 9: Team Collaboration (roles, audit logging, .mcpman/team.json)
- Phase 10: v2.0.0 Release

**Quality Metrics**
- 63 test files
- 1123 tests passing
- Code reviewed and modularized
- APP_VERSION bumped to 2.0.0

## Research Context

- `research/brainstorm-2026-03-05-mcpman-v2-roadmap.md` — Full brainstorm with decisions
- `research/researcher-2026-03-05-ai-tool-config-formats.md` — Exact config formats per tool
- `research/researcher-2026-03-05-ai-coding-tools-mcp-ecosystem.md` — Ecosystem overview
