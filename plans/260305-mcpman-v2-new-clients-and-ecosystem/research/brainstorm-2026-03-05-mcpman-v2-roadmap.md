# Brainstorm: mcpman v2.0 Roadmap
**Date:** 2026-03-05
**Type:** Product Strategy & Feature Expansion
**Status:** Decisions Finalized — Ready for Implementation Plan

---

## 0. Key Decisions (Resolved)

| # | Question | Decision | Rationale |
|---|---|---|---|
| Q1 | Skills spec format | **JSON** | Consistent with mcpman ecosystem (lockfile, config, MCP configs all JSON) |
| Q2 | Registry backend | **Cloudflare Workers + D1/R2** | Same platform as mcpman.pages.dev, $0 to start, global CDN |
| Q3 | Dashboard delivery | **Embed in CLI** | Zero extra install, always matches CLI version, works offline |
| Q4 | TOML parser | **@iarna/toml** | Full spec-compliant, handles edge cases for Codex CLI config.toml |
| Q5 | Agent sync scope | **Full agent definition** | Sync name, description, tools, model, prompt, permissions. More work but complete |
| Q6 | mcpman as MCP server | **Yes, ship it** | AI agents self-manage MCP ecosystem. Unique selling point, no competitor does this |
| Q7 | Breaking changes | **v2.0 major bump** | Allow restructuring ClientType, new deps (TOML, YAML), new command groups |
| Q8 | Naming | **mcpman** | Keep existing brand, already on npm and has recognition |

---

## 1. Current State Analysis

### What mcpman v1.0 Does Well
- 38 commands covering full MCP server lifecycle
- 4 clients: Claude Desktop, Cursor, VS Code, Windsurf
- Encrypted vault (AES-256-CBC), security audit (OSV), trust scoring
- Plugin system, export/import, lockfile, profiles
- 457 tests, production-stable

### What's Missing (Gap Analysis)

| Gap | Impact | Priority |
|---|---|---|
| **Only 4 clients** — Roo Code, Codex CLI, OpenCode, Continue not supported | Losing 60%+ market | CRITICAL |
| **No Claude Code CLI support** — only Claude Desktop (different config!) | Missing largest power-user base | CRITICAL |
| **No skills/rules management** — only manages MCP servers, not agent configs | Incomplete developer experience | HIGH |
| **No remote/HTTP MCP servers** — only stdio transport | Missing cloud MCP trend | HIGH |
| **No marketplace/registry** — depends on npm/Smithery | No ecosystem moat | HIGH |
| **No team collaboration** — planned but not shipped | Enterprise gap | MEDIUM |
| **Website is static HTML** — no interactivity | Poor discovery UX | MEDIUM |
| **No real-time monitoring** — planned dashboard not shipped | Ops gap | LOW |

---

## 2. New Clients to Support

### Priority 1 (CRITICAL — biggest user bases)

| Client | Config Path | Format | Complexity |
|---|---|---|---|
| **Claude Code** | `~/.claude/settings.json` + `.mcp.json` | JSON | MEDIUM — different from Claude Desktop |
| **Roo Code** | `.roo/mcp.json` + `~/.roo/mcp_settings.json` | JSON | LOW — same mcpServers format |
| **Codex CLI** | `~/.codex/config.toml` `[mcp_servers.*]` | TOML | MEDIUM — TOML parsing needed |

### Priority 2 (HIGH — growing user bases)

| Client | Config Path | Format | Complexity |
|---|---|---|---|
| **OpenCode** | `opencode.yaml` `mcpServers:` | YAML | LOW |
| **Continue** | `~/.continue/config.yaml` `mcpServers:` | YAML | LOW |
| **Zed** | `~/.config/zed/settings.json` | JSON | LOW |

### Priority 3 (MEDIUM — niche but growing)

| Client | Notes |
|---|---|
| **Neovim (via plugins)** | Various MCP plugins |
| **JetBrains IDEs** | MCP support via plugins |
| **Emacs** | Community MCP packages |

### Implementation Approach
- Extend `ClientType` union: add `"claude-code" | "roo-code" | "codex-cli" | "opencode" | "continue" | "zed"`
- Create handler per client extending `BaseClientHandler`
- Each handler implements: `isInstalled()`, `readConfig()`, `writeConfig()`, `getConfigPath()`
- Add TOML parser dep for Codex CLI (e.g., `@iarna/toml` or `smol-toml`)
- Add YAML parser dep for OpenCode/Continue (e.g., `yaml`)

---

## 3. Feature Expansion Areas

### A. Skills & Agent Config Management (NEW DOMAIN)

**Concept:** Extend mcpman beyond MCP servers to manage AI coding tool configurations — skills, rules, agent definitions, hooks.

```bash
# Install a shared skill/rule set
mcpman skill install @community/react-patterns
mcpman skill list
mcpman skill remove @community/react-patterns

# Sync agent configs across tools
mcpman agent sync  # Claude Code agents ↔ Roo Code modes ↔ Codex agents

# Import/export full workspace configs
mcpman workspace export mysetup.json
mcpman workspace import mysetup.json --client roo-code
```

**Config mapping layer:**
```
skill.yaml (universal) → adapter → tool-specific format
  → Claude Code: .claude/agents/*.md (YAML frontmatter)
  → Roo Code: .roomodes (YAML customModes)
  → Codex CLI: AGENTS.md + config.toml [agents]
  → Cursor: .cursor/rules/*.mdc (MDC frontmatter)
  → Windsurf: .windsurf/rules/*.md
  → Continue: config.yaml rules:
```

**Risk:** Config formats are very different. Need clear mapping spec. Some features are tool-specific (hooks, permissions, memory) and don't map 1:1.

**Recommendation:** Start with "rules/instructions" sync (simplest mapping), then agents/modes, then hooks.

### B. Remote MCP Server Support (HTTP Transport)

**Trend:** Streamable HTTP replacing stdio for cloud-hosted MCP servers.

```bash
# Install remote MCP server
mcpman install --transport http https://api.example.com/mcp/
mcpman install --transport sse https://mcp.example.com/events

# Manage auth for remote servers
mcpman secrets set REMOTE_TOKEN abc123
mcpman install @remote/server --header "Authorization: Bearer ${REMOTE_TOKEN}"
```

**Implementation:**
- Add `transport` field to lockfile entries: `"stdio" | "http" | "sse"`
- Extend installer to handle URL-based servers
- Add health checking for HTTP MCP endpoints
- Support OAuth flow for authenticated MCP servers

### C. mcpman Registry (Own Ecosystem)

**Concept:** Build own registry at `registry.mcpman.dev` or integrate into existing site.

```bash
mcpman publish                   # Publish server to mcpman registry
mcpman search --registry mcpman  # Search mcpman registry
mcpman install @mcpman/memory    # Install from mcpman registry
```

**Features:**
- Quality scoring (tests, docs, downloads, security)
- Curated collections ("best for web dev", "essential security")
- Author verification
- Version history with changelogs

**Revenue potential:** Featured listings, priority review, enterprise private registries.

### D. Interactive Dashboard (Web UI)

**Already planned in v1.1 roadmap.** Refine:

```bash
mcpman dashboard              # Opens browser
mcpman dashboard --port 3456  # Custom port
```

**Tech stack:** Vite + React + TanStack Router (lightweight, fast)
- Server list with status indicators
- Config diff visualization
- Trust score trends
- One-click install/remove
- Real-time log streaming (WebSocket)

### E. Team Collaboration

**Already planned in v1.2 roadmap.** Refine:

```bash
mcpman team init myteam           # Create team config
mcpman team share                 # Share via Git
mcpman team sync                  # Pull team changes
mcpman team members               # List team members
```

**Implementation:**
- `.mcpman/team.json` in project root (git-tracked)
- Shared lockfile + shared vault (team password)
- Role-based: admin can install/remove, member can only sync
- Audit log: who installed what, when

---

## 4. Proposed v2.0 Roadmap

### v1.1.0 — New Clients Wave 1 (2 weeks)
- [ ] Claude Code client handler
- [ ] Roo Code client handler
- [ ] Update client detector for new clients
- [ ] Update sync engine for new clients
- [ ] Tests for new handlers (target: 500+ tests)

### v1.2.0 — New Clients Wave 2 (2 weeks)
- [ ] Codex CLI client handler (TOML support)
- [ ] OpenCode client handler (YAML support)
- [ ] Continue client handler
- [ ] Zed client handler
- [ ] Total: 10 clients supported

### v1.3.0 — Remote MCP Transport (2 weeks)
- [ ] HTTP transport support in installer
- [ ] SSE transport support
- [ ] OAuth flow for authenticated servers
- [ ] Health checking for remote endpoints
- [ ] `mcpman install --transport http <url>`

### v1.4.0 — Skills & Rules Sync (3 weeks)
- [ ] Universal skill.yaml spec v0.1
- [ ] `mcpman skill install/list/remove`
- [ ] Rules adapter: Claude Code ↔ Roo Code ↔ Cursor ↔ Windsurf
- [ ] `mcpman workspace export/import`

### v1.5.0 — Agent Config Sync (3 weeks)
- [ ] Agent/mode adapter: Claude Code agents ↔ Roo Code modes
- [ ] `mcpman agent sync`
- [ ] Codex CLI AGENTS.md generation
- [ ] Continue config.yaml generation

### v2.0.0 — Ecosystem Release (4 weeks)
- [ ] mcpman Registry (registry.mcpman.dev or API)
- [ ] `mcpman publish` command
- [ ] Curated collections & quality scoring
- [ ] Interactive dashboard (web UI)
- [ ] Team collaboration features
- [ ] New website with docs, guides, marketplace
- [ ] Total: 10 clients, 45+ commands, 600+ tests

---

## 5. Technical Architecture for v2.0

```
mcpman v2.0
├── src/clients/              # 10+ client handlers
│   ├── base-client-handler.ts
│   ├── client-detector.ts
│   ├── claude-desktop.ts     (existing)
│   ├── cursor.ts             (existing)
│   ├── vscode.ts             (existing)
│   ├── windsurf.ts           (existing)
│   ├── claude-code.ts        (NEW)
│   ├── roo-code.ts           (NEW)
│   ├── codex-cli.ts          (NEW)
│   ├── opencode.ts           (NEW)
│   ├── continue.ts           (NEW)
│   └── zed.ts                (NEW)
│
├── src/adapters/             # NEW — config format adapters
│   ├── skill-adapter.ts      # Universal → tool-specific rules
│   ├── agent-adapter.ts      # Universal → tool-specific agents/modes
│   ├── formats/
│   │   ├── claude-code-format.ts
│   │   ├── roo-code-format.ts
│   │   ├── codex-format.ts
│   │   ├── cursor-format.ts
│   │   └── windsurf-format.ts
│   └── types.ts
│
├── src/commands/             # Expanded commands
│   ├── skill.ts              (NEW)
│   ├── agent.ts              (NEW)
│   ├── workspace.ts          (NEW)
│   ├── team.ts               (NEW)
│   ├── dashboard.ts          (NEW)
│   ├── publish.ts            (NEW)
│   └── ...existing 38 commands
│
├── src/core/                 # Expanded core services
│   ├── remote-installer.ts   (NEW — HTTP/SSE transport)
│   ├── skill-service.ts      (NEW)
│   ├── agent-service.ts      (NEW)
│   ├── workspace-service.ts  (NEW)
│   ├── team-service.ts       (NEW)
│   ├── registry-api.ts       (NEW — mcpman registry client)
│   └── ...existing 43 modules
│
└── dashboard/                # NEW — web UI
    ├── src/
    ├── package.json
    └── vite.config.ts
```

---

## 6. Competitive Advantage Post v2.0

| Feature | mcpman v2.0 | Smithery CLI | mcpm.sh | Composio |
|---------|-------------|--------------|---------|----------|
| Clients supported | **10** | 1 | ~2 | API-only |
| MCP server management | Yes | Yes | Yes | Yes |
| Skills/rules sync | **Yes** | No | No | No |
| Agent/mode sync | **Yes** | No | No | No |
| Remote MCP (HTTP) | **Yes** | Partial | No | Yes |
| Own registry | **Yes** | Yes | No | Yes |
| Encrypted vault | Yes | No | No | No |
| Lockfile | Yes | No | No | No |
| Plugin system | Yes | No | No | Yes |
| Team collaboration | **Yes** | No | No | Enterprise |
| Dashboard | **Yes** | Web-only | No | Web-only |
| Open-source | **Yes** | Partial | Yes | No |

**Moat:** Only tool doing MCP servers + skills + agents + 10 clients + vault + registry. No competitor comes close.

---

## 7. Go-to-Market for v2.0

### Launch Strategy
1. **Pre-launch (2 weeks before):** Tease new client support on X/Twitter, Reddit
2. **Launch day:** GitHub release + HN post + Reddit + dev.to + Product Hunt
3. **Week 1:** Video tutorials (YouTube), respond to every issue/comment
4. **Month 1:** Reach out to AI tool communities (Roo Code Discord, Claude Code GitHub)

### Distribution
- npm (`npx mcpman`)
- GitHub releases
- Homebrew tap
- VS Code extension (companion for Roo Code/Cursor users)

### Community
- Discord server for mcpman users
- GitHub Discussions for feature requests
- Monthly "MCP server of the month" curation
- Contributing guide for new client handlers

### Sponsorship
- GitHub Sponsors tier: $5 (individual) / $50 (startup) / $500 (enterprise)
- Feature company logos on website for $500+/mo sponsors
- Enterprise: private registry, priority support

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI tools change config format | MEDIUM | HIGH | Adapter pattern isolates changes |
| TOML/YAML parsing edge cases | MEDIUM | LOW | Use battle-tested parsers |
| Skills sync is too complex | HIGH | MEDIUM | Start with rules (simplest), iterate |
| Low adoption of new features | MEDIUM | MEDIUM | Ship incrementally, get feedback |
| Registry hosting costs | LOW | LOW | Start serverless (Cloudflare Workers) |
| Scope creep beyond v2.0 | HIGH | MEDIUM | Strict phase gates, MVP each release |

---

## 9. Unresolved Questions

1. **Skills spec format:** YAML or extend existing skill.yaml in ClaudeKit? How much to standardize?
2. **Registry backend:** Cloudflare Workers + D1/R2 vs Supabase vs self-hosted?
3. **Dashboard bundling:** Embed in CLI (serve static) or separate package?
4. **TOML dependency:** `smol-toml` (lightweight) vs `@iarna/toml` (full-featured)?
5. **Agent sync granularity:** Full agent definition or just rules/instructions?
6. **Monetization timing:** When to introduce paid features without alienating early adopters?
7. **Should mcpman also function as an MCP server itself?** (Expose install/list/audit as MCP tools — other AI agents could manage MCP servers through mcpman)
8. **Breaking changes:** v2.0 as major bump or maintain v1.x compatibility?
