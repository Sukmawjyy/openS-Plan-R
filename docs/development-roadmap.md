# mcpman Development Roadmap

**Current Version:** 2.0.0
**Last Updated:** 2026-03-05
**Status:** v2.0.0 Released (100% - Phases 1-10 complete)

## Release Timeline

### v0.1.0 (2026-02-27) — MVP
**Status:** Complete

- Multi-client support (Claude Desktop, Cursor, VS Code, Windsurf, Claude Code CLI, Roo Code)
- `install`, `list`, `remove`, `sync`, `doctor`, `init`
- 50 tests, ~50KB bundled

---

### v0.2.0 (2026-02-28) — Security & Auditability
**Status:** Complete

- `secrets` — AES-256-CBC vault, PBKDF2 key derivation
- `audit` — OSV vulnerability scanning + trust scoring (0–100)
- `update` — check/apply server updates, 24h notification cache
- 151 tests (11 files), 87KB bundled

---

### v0.3.0 (2026-02-28) — Enterprise & CI/CD
**Status:** Complete

- Vault installer integration (secrets auto-inject during install)
- `sync --remove`, `audit --fix`, `audit --fix --yes`
- `server-updater.ts` shared module (DRY)
- GitHub Actions CI/CD (Node 20, 22)
- 188 tests (13 files), 94.5KB bundled

---

### v0.4.0 (2026-02-28) — Discovery & Configuration
**Status:** Complete

- `config` — global config at ~/.mcpman/config.json
- `search` — npm/Smithery registry search with pagination
- `info` — package details, trust score, installed status
- `run` — launch servers with vault secrets auto-injected
- 243 tests (17 files), ~110KB bundled

---

### v0.5.0 (2026-02-28) — Extensibility & Portability
**Status:** Complete

- `plugin` — npm-based plugin system for custom registries
- `export` — portable JSON bundle (config + lockfile + vault + plugins)
- `import` — restore from bundle with --dry-run and --yes
- Plugin prefix resolution: `prefix:server` → plugin.resolve()
- 281 tests (20 files), ~131KB bundled

---

### v0.6.0 (2026-02-28) — Operations & Refinement
**Status:** Complete

- `profiles` — named server config snapshots
- `upgrade` — self-upgrade mcpman CLI via npm
- `logs` — stream stdout/stderr from MCP servers
- `test` — JSON-RPC initialize + tools/list validation
- `plugin-health-checker.ts` — plugin diagnostics in doctor
- Smithery API fix (qualifiedName, useCount, pageSize)
- 325 tests (26 files), ~140KB bundled

---

### v0.7.0 (2026-02-28) — Developer Tooling
**Status:** Complete

- `create` — scaffold new MCP server project
- `link` — link local server directory to clients
- `watch` — file-watch + auto-reload local servers
- `registry` — manage custom registries
- `completions` — shell completion generation (bash/zsh/fish)
- `why` — explain why a server is installed

---

### v0.8.0 (2026-02-28) — Advanced Management
**Status:** Complete

- `env` — manage per-server environment variables
- `bench` — benchmark server response performance
- `diff` — diff lockfile vs actual client configs
- `group` — organize servers into named groups
- `pin` — pin server to specific version
- `rollback` — rollback to previous install state

---

### v0.9.0 (2026-02-28) — Automation & Workflows
**Status:** Complete

- `validate` — validate lockfile/config schema
- `status` — aggregated server status summary
- `replay` — replay installs from history log
- `alias` — define server name aliases
- `template` — save/apply config templates
- `notify` — manage update notification settings

---

### v1.0.0 (2026-02-28) — Stable Release
**Status:** Current

- 38 CLI commands covering full MCP server lifecycle
- 457 tests across 45 test files
- 92 source files (stable, no breaking changes)
- Semantic versioning guarantee from this release forward
- Production-grade stability
- Website launched at https://mcpman.pages.dev/ (Cloudflare Pages)

---

## Milestone Progress (v2.0.0)

| Component | Status | Progress | Notes |
|-----------|--------|----------|-------|
| **Wave 1 Clients** | Complete | 100% | Claude Code, Roo Code |
| **Wave 2 Clients** | Complete | 100% | Codex CLI, OpenCode, Continue, Zed |
| **Supported Clients** | Complete | 100% | 10 clients (4 initial → 10 total) |
| **Format Adapters** | Complete | 100% | TOML, YAML (array + map), JSON (context_servers), Skills (5 formats) |
| **Test Suite** | Complete | 100% | 1123 tests, 64 files |
| **Config Handling** | Complete | 100% | All format converters working, guards for empty values |
| **Sync Engine** | Complete | 100% | Multi-client support, remote transport, skill sync |
| **Remote Transport** | Complete | 100% | HTTP/SSE layer — Phase 3 complete |
| **Skills Sync** | Complete | 100% | Universal skill spec + format adapters — Phase 4 complete |
| **Agent Config Sync** | Complete | 100% | Full agent distribution + tool/model mapping — Phase 5 complete |
| **MCP Server Mode** | Complete | 100% | 8 tools via MCP protocol — Phase 6 complete |
| **Registry & Marketplace** | Complete | 100% | Community discovery + publish — Phase 7 complete |
| **Dashboard** | Complete | 100% | HTTP API + web UI — Phase 8 complete |
| **Team Collab** | Complete | 100% | RBAC + shared vault — Phase 9 complete |
| **v2.0 Release** | Complete | 100% | Production release — Phase 10 complete |

---

## v2.0 Roadmap (New Clients & Ecosystem Expansion)

**Status:** Released — All Phases Complete (100%)

### v2.0-phase1 (2026-03-05) — Wave 1 New Clients
**Status:** Complete

- Claude Code CLI client handler
- Roo Code client handler
- 6 clients → 8 clients

### v2.0-phase2 (2026-03-05) — Wave 2 New Clients
**Status:** Complete

- Codex CLI (TOML config)
- OpenCode (YAML config)
- Continue (YAML array format)
- Zed (context_servers key)
- 8 clients → 10 clients
- New deps: `@iarna/toml ^3.0.0`, `yaml ^2.7.0`
- 655 tests passing

### v2.0-phase3 (2026-03-05) — Remote MCP Transport
**Status:** Complete

- HTTP/SSE transport for remote server connections ✓
- Enable MCP servers on remote machines ✓
- ServerEntry expanded with type/url/headers ✓
- New modules: remote-installer.ts, remote-health-checker.ts ✓
- 725/725 tests (70 new for remote transport) ✓

### v2.0-phase4 (2026-03-05) — Skills & Rules Sync
**Status:** Complete

- Universal mcpman-skill.json specification ✓
- Format adapters for all 10 clients ✓
- mcpman skill command (install/list/remove/sync/export) ✓
- 9 new files: skill-types, skill-service, skill-adapter, format-registry, 5 adapters ✓
- 795/795 tests (70 new for skills/rules) ✓

### v2.0-phase5 (2026-03-05) — Agent Config Sync
**Status:** Complete

- Full agent configuration synchronization across 10 clients ✓
- Universal AgentSpec in mcpman-skill.json ✓
- Format adapters for Claude Code, Roo Code, Codex ✓
- Tool mapping layer (unified tools across clients) ✓
- Model mapping layer (fast/balanced/powerful tiers) ✓
- mcpman agent command (sync/list/export) ✓
- 844/844 tests (49 new for agent sync) ✓

### v2.0-phase6 (2026-03-05) — mcpman as MCP Server
**Status:** Complete

- Expose mcpman commands via MCP protocol ✓
- 8 tools: install, remove, list, search, audit, doctor, info, status ✓
- `mcpman serve` command with optional `--port` flag ✓
- Write protection: `--allow-write` flag ✓
- JSON-RPC protocol over stdio ✓

### v2.0-phase7 (2026-03-05) — Registry & Marketplace
**Status:** Complete

- Centralized MCP server registry ✓
- `mcpman publish` command ✓
- `mcpman-registry-client.ts` for registry HTTP communication ✓
- `publish-service.ts` handles versioning + checksums ✓
- Community server discovery and sharing ✓

### v2.0-phase8 (2026-03-05) — Embedded Dashboard
**Status:** Complete

- Web-based configuration and monitoring UI ✓
- `mcpman dashboard` command with optional `--port` flag ✓
- `dashboard-api.ts` HTTP API endpoints ✓
- Real-time server health visualization ✓
- WebSocket support for live updates ✓

### v2.0-phase9 (2026-03-05) — Team Collaboration
**Status:** Complete

- `mcpman team` with 7 subcommands: init, add-member, remove-member, list, sync, export, invite ✓
- `team-service.ts` CRUD operations ✓
- `team-types.ts` Team/Member/Role interfaces ✓
- RBAC: admin/maintainer/viewer roles ✓
- Shared vault for team secrets ✓
- Audit logging of team actions ✓

### v2.0-phase10 (2026-03-05) — v2.0 Release & Launch
**Status:** Complete

- Release v2.0.0 stable ✓
- 1123 tests (64 files) passing ✓
- 43 CLI commands ✓
- 56 core modules ✓
- 10 AI client support ✓
- Documentation updated ✓

---

## Post v1.0 Roadmap

### v1.1.0 — Dashboard & Monitoring
- Web dashboard (`mcpman dashboard`) for config visualization
- Real-time server health monitoring (WebSocket streaming)
- Trust score history and trends
- Plugin marketplace integration

### v1.2.0 — Team Collaboration
- Shared vault for teams (encrypted sync)
- Role-based access control (admin/maintainer/viewer)
- Audit logs (who installed/removed what)
- Team config namespaces

---

## Success Metrics (v1.0.0)

| Metric | v0.6 | v1.0 Target | v1.0 Current |
|--------|------|-------------|--------------|
| npm downloads/week | 200+ | 1,000+ | Growing |
| GitHub stars | 80+ | 500+ | Growing |
| Test coverage | 85%+ | 95%+ | 457 tests |
| CLI commands | 20 | 38 | 38 |
| Supported clients | 4 | 6 | 10 |

---

## Getting Started

```bash
git clone https://github.com/tranhoangtu-it/mcpman
npm install
npm run test:run
git checkout -b feat/my-feature
```

**Code Review Standards:**
- All PRs require passing tests + lint
- Docs updated for user-facing changes
- No breaking changes without major version bump
- Conventional commit format required
