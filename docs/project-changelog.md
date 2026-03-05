# mcpman Project Changelog

**Current Version:** 2.0.0
**Last Updated:** 2026-03-05
**Progress:** Phases 1-10 ✓ (100% complete)
**Format:** Semantic Versioning (MAJOR.MINOR.PATCH)

---

## [2.0.0] — Full Release — 2026-03-05

### Summary

mcpman v2.0.0 released: major ecosystem expansion with 10 AI client support, remote transport, universal skills/agent sync, MCP server mode, registry/marketplace, dashboard API, and team collaboration. Complete feature parity across 43 CLI commands (new: serve, publish, dashboard, team, skill, agent). 1123 tests (64 files) passing, production-ready with semantic versioning guarantee.

### Added

- **mcpman as MCP Server** — `mcpman serve [--port 8000]` exposes 8 tools (install, remove, list, search, audit, doctor, info, status); write protection via `--allow-write` flag
- **Registry & Publishing** — `mcpman publish --registry <url>` publishes MCP servers; `mcpman-registry-client.ts` + `publish-service.ts` handle registry operations
- **Dashboard HTTP API** — `mcpman dashboard [--port 3000]`; `dashboard-api.ts` REST endpoints + WebSocket support
- **Team Collaboration** — `mcpman team` with 7 subcommands (init, add-member, remove-member, list, sync, export, invite); RBAC (admin/maintainer/viewer); shared vault; audit logging
- **Skills & Agent Sync** — universal `mcpman-skill.json` spec; format adapters for all 10 clients; `skill-service.ts`, `agent-service.ts`, `skill-types.ts`
- **Remote HTTP/SSE Transport** — HTTP and SSE support for remote MCP servers; `remote-installer.ts`, `remote-health-checker.ts`
- **10 AI Client Support** — Claude Desktop, Claude Code CLI, Cursor, VS Code, Windsurf, Roo Code, Codex CLI, OpenCode, Continue, Zed

### Technical Details

- **Total Commands:** 43 (new: serve, publish, dashboard, team, skill, agent)
- **Core Modules:** 56 (added: dashboard-api, team-service, team-types, mcpman-registry-client, publish-service)
- **Test Count:** 1123 across 64 files
- **Test Coverage:** Unit + integration + remote transport + team + skills/agents
- **Source Files:** 132 TypeScript files

### Breaking Changes

None. Fully backward compatible with v1.0 configs, vault formats, and lockfiles.

---

## [v2.0-phase5] — Phase 5 Completion — 2026-03-05

### Summary

Phase 5 complete: full agent configuration synchronization implemented across all 10 AI coding clients. Extended mcpman-skill.json spec with AgentSpec schema for tool-level agent definitions. Created 3 format-specific adapters (Claude Code, Roo Code, Codex) for agent config distribution. Implemented tool mapping layer (Claude tools → Roo groups → Codex implicit) and model mapping (fast/balanced/powerful tiers).

### Added

- **Universal agent spec** — `mcpman-skill.json` AgentSpec schema (name, description, role, tools[], deniedTools[], model, filePatterns[], instructions)
- **Agent format adapters (3 files):**
  - `claude-code-agent-format.ts` → `.claude/agents/*.md` with YAML frontmatter
  - `roo-code-agent-format.ts` → `.roomodes` custom mode entries
  - `codex-agent-format.ts` → `AGENTS.md` section generation
- **`src/core/agent-service.ts`** — agent sync/list/export logic; tool + model mapping
- **`src/commands/agent.ts`** — `mcpman agent sync/list/export` CLI commands
- **`src/types/skill-types.ts` updated** — AgentSpec interface and agent-related types
- **Tool mapping layer** — unified tool list conversion across clients
  - Claude tools (Read, Glob, Grep, Edit, Write, Bash) → Roo groups → Codex implicit
  - Denying tools supported (deniedTools[])
- **Model mapping layer** — abstract tier system
  - `fast` → claude-haiku-4-5-20251001
  - `balanced` → claude-3-5-sonnet-20241022
  - `powerful` → claude-opus-4-6
- **49 new agent tests** — adapter validation, tool/model mapping, sync engine integration
- **Total tests:** 844 (up from 795)

### Technical Details

- **New Source Files:** 3 (agent format adapters) + 1 service + 1 command = 5 total
- **Total Core Modules:** 59 (up from 54)
- **Test Count:** 844 (49 new for agent sync)
- **Agent Storage:** `~/.mcpman/agents/` directory
- **Format Compatibility:** All 10 clients supported (tool/model mapping handles differences)

### Architecture

Agents → universal spec → format adapters → client-specific agent configs
```
mcpman-skill.json (AgentSpec[])
├── claude-code-agent-format.ts → .claude/agents/*.md
├── roo-code-agent-format.ts → .roomodes customModes[]
└── codex-agent-format.ts → AGENTS.md sections
```

---

## [v2.0-phase4] — Phase 4 Completion — 2026-03-05

### Summary

Phase 4 complete: added universal skills and rules sync for all 10 AI coding clients. Defined mcpman-skill.json spec with format adapters for Claude Code, Cursor, Roo Code, Codex CLI, and Windsurf. Implemented skill command with install/list/remove/sync/export subcommands.

### Added

- **Universal skill spec** — `mcpman-skill.json` JSON schema (name, version, description, rules[], mcp_servers[])
- **Skills & Rules Sync** — cross-client rule distribution via format adapters
- **`src/types/skill-types.ts`** — skill interfaces, format adapter types
- **`src/core/skill-service.ts`** — skill CRUD logic (install/remove/list/sync/export)
- **`src/adapters/skill-adapter.ts`** — universal spec parser, registry client integration
- **`src/adapters/format-registry.ts`** — adapter factory pattern dispatcher
- **Format adapters (5 files):**
  - `claude-code-format.ts` → CLAUDE.md content generation
  - `cursor-format.ts` → .cursor/rules/*.mdc with YAML frontmatter
  - `roo-code-format.ts` → .roo/rules/*.md file generation
  - `codex-format.ts` → AGENTS.md content generation
  - `windsurf-format.ts` → .windsurf/rules/*.md file generation
- **`mcpman skill` command** — 5 subcommands:
  - `install <name>` — download and install skill
  - `list` — show installed skills
  - `remove <name>` — uninstall skill
  - `sync [--client <type>]` — sync rules across clients
  - `export <name>` — export rules as mcpman-skill.json
- **Skill registry** — npm-based skill lookup with fallback handling
- **70 new tests** — format adapter validation, sync engine integration, CLI parsing

### Updated Modules

- `src/index.ts` — register `skill` command
- `src/core/sync-engine.ts` — skill rule sync integration
- Format detection in skill-adapter.ts

### Technical Details

- **New Source Files:** 9 (skill-types, skill-service, skill-adapter, format-registry, 5 adapters)
- **Total Core Modules:** 54 (up from 45)
- **Test Count:** 795 (up from 725)
- **Skill Storage:** `~/.mcpman/skills/` directory
- **Format Compatibility:** All 10 clients supported

### Architecture

Skills → universal spec → format adapters → client-specific rules
```
mcpman-skill.json
├── claude-code-format.ts → CLAUDE.md
├── cursor-format.ts → .cursor/rules/*.mdc (+ frontmatter)
├── roo-code-format.ts → .roo/rules/*.md
├── codex-format.ts → AGENTS.md
└── windsurf-format.ts → .windsurf/rules/*.md
```

---

## [v2.0-phase3] — Phase 3 Completion — 2026-03-05

### Summary

Phase 3 complete: added remote MCP server transport support via HTTP (Streamable HTTP) and SSE. Expanded ServerEntry with transport type, URL, and headers. New modules for remote installation and health checking. All 10 clients now support both local (stdio) and remote transports.

### Added

- **Remote HTTP/SSE Transport** — enable MCP servers on remote machines
- **`remote-installer.ts`** — HTTP/SSE server registration, URL validation, endpoint probing
- **`remote-health-checker.ts`** — HTTP GET/POST health checks, SSE event stream validation
- **ServerEntry expansion** (`src/clients/types.ts`) — `type?: "stdio" | "http" | "sse"`, `url?`, `headers?`
- **`--url` flag** — `mcpman install --url https://api.example.com/mcp/ --name my-server`
- **Remote transport in `mcpman list`** — displays transport type (stdio/http/sse) per server
- **JSON-RPC over HTTP** — `mcpman test` validates remote servers via POST with Content-Type
- **Lockfile transport persistence** — `mcpman.lock` stores transport type per server
- **Multi-client sync for remote** — remote servers sync across all 10 clients seamlessly
- **70 new tests** — HTTP endpoint mocking, URL validation, SSE parsing, remote sync

### Updated Modules

- `src/core/installer.ts` — detects `--url` flag, delegates to remote installer
- `src/core/health-checker.ts` — routes HTTP/SSE entries to remote health checker
- `src/core/mcp-tester.ts` — JSON-RPC POST over HTTP with proper Content-Type
- `src/core/lockfile.ts` — transport type schema update
- `src/core/sync-engine.ts` — multi-client sync includes remote servers
- `src/commands/test-command.ts` — remote server testing support
- `src/commands/list.ts` — transport indicator per server
- `src/core/config-diff.ts` — drift detection for remote entries
- `src/core/config-validator.ts` — validates transport fields

### Technical Details

- **Supported Clients:** 10 (all support remote transport)
- **New Source Files:** 2 (`remote-installer.ts`, `remote-health-checker.ts`)
- **Total Core Modules:** 45 (up from 43)
- **Test Count:** 725 (up from 655)
- **New Test Files:** 2+ (70 new tests)

### Architecture

Transport resolution: `ServerEntry.type` determines handler path
```
stdio → spawn process, write JSON-RPC to stdin/stdout
http  → POST JSON-RPC to URL, parse response body
sse   → GET URL, stream JSON-RPC events via EventSource
```

---

## [v2.0-phase2] — Phase 2 Completion — 2026-03-05

### Summary

Phase 2 complete: expanded client support from 6 to 10 AI clients. Added Codex CLI, OpenCode, Continue, and Zed as first-class supported clients. Introduced TOML and YAML config parsing capabilities (new deps: `@iarna/toml`, `yaml`).

### Added

- **Codex CLI client** (`src/clients/codex-cli.ts`) — TOML config handler; manages MCP servers at `~/.codex/config.toml` under `[mcp_servers.*]` tables
- **OpenCode client** (`src/clients/opencode.ts`) — YAML config handler; manages MCP servers at `~/.config/opencode/opencode.json` under `mcpServers:` key
- **Continue client** (`src/clients/continue-client.ts`) — YAML config handler with array↔map conversion; manages MCP servers at `~/.continue/config.yaml` (array format: `mcpServers: [{name, command, args}]`)
- **Zed client** (`src/clients/zed.ts`) — JSON config handler using `context_servers` key (not `mcpServers`); manages `~/.config/zed/settings.json`
- **`@iarna/toml ^3.0.0`** — TOML parsing/serialization for Codex CLI handler
- **`yaml ^2.7.0`** — YAML parsing/serialization for OpenCode and Continue handlers
- **`ClientType` union expanded** — `types.ts` now includes `"codex-cli"`, `"opencode"`, `"continue"`, `"zed"`
- **`client-detector.ts` updated** — `getAllClientTypes()` returns all 10 clients
- **`paths.ts` updated** — `resolveConfigPath()` handles all 4 new client config paths
- **4 new test files** — `codex-cli.test.ts`, `opencode.test.ts`, `continue-client.test.ts`, `zed.test.ts`

### Technical Details

- **Supported Clients:** 10 (Claude Desktop, Claude Code CLI, Cursor, VS Code, Windsurf, Roo Code, Codex CLI, OpenCode, Continue, Zed)
- **New Source Files:** 4 (`codex-cli.ts`, `opencode.ts`, `continue-client.ts`, `zed.ts`)
- **Total Client Files:** 13
- **Test Count:** 520+ (up from 457)
- **New Test Files:** 4 (total: 49)

### Migration

- No breaking changes; existing configs for all prior clients are unaffected
- New clients auto-detected on first run via config path existence checks
- `--client codex-cli`, `--client opencode`, `--client continue`, `--client zed` flags now valid

---

## [1.0.0] — Stable Baseline → v2.0 Launch — 2026-03-05

### Summary (from v1.0 baseline)

v1.0.0 stable release with 38 CLI commands, 457 tests. This served as the baseline for v2.0 development. See v2.0.0 entry above for current state.

### Phase 1: Expanded Client Support (2026-03-05)

Phase 1 complete: expanded client support from 4 to 6 AI clients. Added Claude Code CLI and Roo Code as first-class supported clients, bringing mcpman to full coverage of the major MCP-compatible AI development tools.

### Added

- **Claude Code CLI client** (`src/clients/claude-code.ts`) — manages MCP servers at `~/.claude/.mcp.json` (user-level global config, all platforms)
- **Roo Code client** (`src/clients/roo-code.ts`) — manages MCP servers at VS Code extension globalStorage (`rooveterinaryinc.roo-cline/settings/mcp_settings.json`)
- **`ClientType` union updated** — `types.ts` now includes `"claude-code"` and `"roo-code"`
- **`client-detector.ts` updated** — `getAllClientTypes()` returns all 6 clients; `getClient()` dispatches to new handlers
- **`paths.ts` updated** — `resolveConfigPath()` handles `claude-code` (cross-platform `~/.claude/.mcp.json`) and `roo-code` (platform-aware globalStorage path)

### Technical Details

- **Supported Clients:** 6 (Claude Desktop, Claude Code CLI, Cursor, VS Code, Windsurf, Roo Code)
- **New Source Files:** 2 (`claude-code.ts`, `roo-code.ts`)
- **Total Client Files:** 9

### Migration

- No breaking changes; existing configs for Claude Desktop, Cursor, VS Code, and Windsurf are unaffected
- New clients are auto-detected on first run; `--client claude-code` and `--client roo-code` flags now valid

---

## [1.0.0] — 2026-02-28

### Summary

Stable release. 38 CLI commands, 457 tests (45 files), 92 source files. Semantic versioning guarantee from this release forward — no breaking changes without a major version bump.

### Added

- **Stable API guarantee** — all existing commands frozen; breaking changes require v2.0
- **`validate` command** — validate lockfile/config schema integrity
- **`status` command** — aggregated server status summary across all clients
- **`replay` command** — replay install sequence from history log
- **`alias` command** — define and manage server name aliases
- **`template` command** — save/apply reusable config templates
- **`notify` command** — manage update notification preferences
- **Website** — https://mcpman.pages.dev/ deployed on Cloudflare Pages (`pages.yml` workflow)

### Technical Details

- **Command Count:** 38 subcommands
- **Test Coverage:** 457 tests across 45 test files
- **Source Files:** 92 TypeScript files
- **Node Requirement:** ≥20.0.0
- **CI/CD Workflows:** `ci.yml`, `publish.yml`, `pages.yml`

### Migration from v0.9.0

- No breaking changes; fully backward compatible with all prior config/vault formats

---

## [0.9.0] — 2026-02-28

### Added

- **`validate`** — validate lockfile and client config schema
- **`status`** — aggregated server status across all clients
- **`replay`** — replay installs from history log
- **`alias`** — create/list/remove server name aliases
- **`template`** — save named config templates and apply to new installs
- **`notify`** — configure update notification preferences
- **New core:** `history-service.ts`, `alias-manager.ts`, `template-service.ts`, `notify-service.ts`, `status-checker.ts`

**Test Coverage:** 457 tests across 45 test files

---

## [0.8.0] — 2026-02-28

### Added

- **`env`** — inspect and override per-server environment variables
- **`bench`** — benchmark MCP server response latency and throughput
- **`diff`** — diff lockfile vs actual client configs
- **`group`** — organize servers into named groups for bulk operations
- **`pin`** — pin server to specific version, prevent auto-updates
- **`rollback`** — rollback to previous install state
- **New core:** `env-manager.ts`, `bench-service.ts`, `config-differ.ts`, `group-manager.ts`, `pin-service.ts`, `rollback-service.ts`

---

## [0.7.0] — 2026-02-28

### Added

- **`create`** — scaffold a new MCP server project with boilerplate
- **`link`** — link a local server directory into AI client configs
- **`watch`** — watch local server files, auto-reload clients on change
- **`registry`** — add/remove/list custom registries beyond npm and Smithery
- **`completions`** — generate shell completions for bash, zsh, fish
- **`why`** — explain why a server is installed and what depends on it
- **New core:** `scaffold-service.ts`, `link-service.ts`, `file-watcher-service.ts`, `registry-manager.ts`, `completion-generator.ts`, `why-service.ts`

---

## [0.6.0] — 2026-02-28

### Added

- **`profiles` command** — create/switch/list/delete named server config snapshots
- **`upgrade` command** — self-upgrade mcpman CLI via npm (no sudo required)
- **`logs` command** — stream stdout/stderr from MCP servers (vault secrets injected)
- **`test` command** — JSON-RPC initialize + tools/list validation; reports response time
- **`plugin-health-checker.ts`** — plugin diagnostics integrated into `doctor`
- **`profile-service.ts`** — named profile CRUD at ~/.mcpman/profiles/
- **`mcp-tester.ts`** — JSON-RPC validator core
- **`getProfilesDir()` utility** — cross-platform profiles path resolution

### Fixed

- **Smithery API** — now uses real endpoints: `qualifiedName`, `useCount`, `pageSize`
- **Plugin health checks** — integrated into `doctor`, validates registry reachability

### Technical Details

- **Test Coverage:** 325 tests across 26 test files
- **Bundle Size:** ~140KB

---

## [0.5.0] — 2026-02-28

- **`plugin`** — npm-based plugin system (`add/remove/list`; `~/.mcpman/plugins/`)
- **`export`** — portable JSON bundle (config + lockfile + vault + plugins)
- **`import`** — restore from bundle (`--dry-run`, `--yes`)
- Plugin prefix resolution in `server-resolver.ts` and `registry-search.ts`
- **New core:** `export-import-service.ts`, `plugin-loader.ts` — 281 tests (20 files)

---

## [0.4.0] — 2026-02-28

- **`config`** — global config CRUD at `~/.mcpman/config.json`
- **`search`** — npm/Smithery registry search with pagination
- **`info`** — package metadata, trust score, installed status
- **`run`** — launch server with vault secrets auto-injected into `process.env`
- 243 tests (17 files), ~110KB bundled

---

## [0.3.0] — 2026-02-28

- Vault installer integration (secrets pre-fill env prompts; save after install)
- `sync --remove` — clean extra servers from clients not in lockfile
- `audit --fix [--yes]` — auto-update vulnerable packages, re-scan to verify
- `server-updater.ts` — shared update logic (DRY)
- GitHub Actions CI/CD (`ci.yml` Node 20/22, `publish.yml` tag-based)
- 188 tests (13 files), 94.5KB bundled

---

## [0.2.0] — 2026-02-28

- **`secrets`** — AES-256-CBC vault with PBKDF2 key derivation
- **`audit`** — OSV vulnerability scanning + trust score (0–100)
- **`update`** — check/apply server updates, 24h notification cache
- 151 tests (11 files), 87KB bundled

---

## [0.1.0] — 2026-02-27 (Initial Release)

- Multi-client support (Phase 1): Claude Desktop, Cursor, VS Code, Windsurf
- `install`, `list`, `remove`, `sync`, `doctor`, `init`
- `mcpman.lock` for reproducible setups; npm/Smithery/GitHub URL resolution
- TypeScript 5.7 strict, tsup, biome 1.9, vitest 4 — 50 tests, ~50KB bundled

---

## Version Compatibility Matrix

| Version | Node | Commands | Tests | Clients | Bundle |
|---------|------|----------|-------|---------|--------|
| 0.1.0 | ≥20 | 6 | 50 | 4 | 50KB |
| 0.2.0 | ≥20 | 9 | 151 | 4 | 87KB |
| 0.3.0 | ≥20 | 9 | 188 | 4 | 94.5KB |
| 0.4.0 | ≥20 | 13 | 243 | 4 | 110KB |
| 0.5.0 | ≥20 | 16 | 281 | 4 | 131KB |
| 0.6.0 | ≥20 | 20 | 325 | 4 | 140KB |
| 0.7.0 | ≥20 | 26 | ~370 | 4 | ~155KB |
| 0.8.0 | ≥20 | 32 | ~415 | 4 | ~170KB |
| 0.9.0 | ≥20 | 38 | 457 | 4 | ~185KB |
| 1.0.0 | ≥20 | 38 | 457 | 4 | ~185KB |
| 2.0.0 | ≥20 | 43 | 1123 | 10 | ~250KB |

---

## Security Advisories

No critical vulnerabilities reported across all releases. Vault uses AES-256-CBC + PBKDF2. Regular OSV scanning via `audit` command.

---

**Report bugs:** https://github.com/tranhoangtu-it/mcpman/issues
**npm:** https://www.npmjs.com/package/mcpman
**Website:** https://mcpman.pages.dev/
