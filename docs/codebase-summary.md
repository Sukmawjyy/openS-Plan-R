# mcpman Codebase Summary

**Version:** 2.0.0
**Last Updated:** 2026-03-05
**Tech Stack:** TypeScript + Node.js ≥20, citty CLI, @clack/prompts, vitest v4, @iarna/toml, yaml

## Project Overview

mcpman is a universal package manager for Model Context Protocol (MCP) servers. It enables installing, managing, and inspecting MCP servers across all major AI clients (10 clients: Claude Desktop, Cursor, VS Code, Windsurf, Claude Code CLI, Roo Code, Codex CLI, OpenCode, Continue, Zed) from a single CLI. v2.0 adds registry/marketplace, dashboard, team collaboration, and exposes mcpman as an MCP server.

**Repository:** https://github.com/tranhoangtu-it/mcpman
**npm:** https://www.npmjs.com/package/mcpman
**Website:** https://mcpman.pages.dev/

## Directory Structure

```
src/
├── index.ts                         # CLI entry point (38 subcommands via citty)
├── clients/                         # AI client integrations (13 files)
│   ├── base-client-handler.ts       # Abstract base for client handlers
│   ├── client-detector.ts           # Auto-detect installed clients
│   ├── claude-desktop.ts            # Claude Desktop config
│   ├── claude-code.ts               # Claude Code CLI (~/.claude/.mcp.json)
│   ├── cursor.ts                    # Cursor IDE support
│   ├── vscode.ts                    # VS Code integration
│   ├── windsurf.ts                  # Windsurf IDE support
│   ├── roo-code.ts                  # Roo Code VS Code extension support
│   ├── codex-cli.ts                 # Codex CLI (~/.codex/config.toml, TOML)
│   ├── opencode.ts                  # OpenCode (~/.config/opencode/opencode.json)
│   ├── continue-client.ts           # Continue (~/.continue/config.yaml, YAML array)
│   ├── zed.ts                       # Zed (~/.config/zed/settings.json, context_servers)
│   └── types.ts                     # ClientType, ConfigFile interfaces
├── commands/                        # 38 subcommands
│   ├── install.ts                   # Install MCP servers
│   ├── list.ts                      # List installed servers
│   ├── remove.ts                    # Uninstall servers
│   ├── doctor.ts                    # Health diagnostics
│   ├── init.ts                      # Init project mcpman.lock
│   ├── secrets.ts                   # Vault secret management
│   ├── sync.ts                      # Cross-client config sync
│   ├── audit.ts                     # Security vulnerability scan
│   ├── update.ts                    # Check/apply server updates
│   ├── config.ts                    # Global config CRUD
│   ├── search.ts                    # Registry search (npm/Smithery)
│   ├── info.ts                      # Package details + trust score
│   ├── run.ts                       # Launch servers with vault secrets
│   ├── plugin.ts                    # Plugin management
│   ├── export-command.ts            # Export config bundles
│   ├── import-command.ts            # Restore from bundles
│   ├── profiles.ts                  # Named config profiles
│   ├── upgrade.ts                   # Self-upgrade mcpman CLI
│   ├── logs.ts                      # Stream server stdout/stderr
│   ├── test-command.ts              # JSON-RPC validation
│   ├── create.ts                    # Scaffold new MCP server project
│   ├── link.ts                      # Link local server to clients
│   ├── watch.ts                     # Watch + auto-reload local servers
│   ├── registry.ts                  # Manage custom registries
│   ├── completions.ts               # Shell completion generation
│   ├── why.ts                       # Explain why server is installed
│   ├── env.ts                       # Manage server env vars
│   ├── bench.ts                     # Benchmark server performance
│   ├── diff.ts                      # Diff lockfile vs client configs
│   ├── group.ts                     # Manage server groups
│   ├── pin.ts                       # Pin server versions
│   ├── rollback.ts                  # Rollback to previous state
│   ├── validate.ts                  # Validate lockfile/config schema
│   ├── status.ts                    # Show server status summary
│   ├── replay.ts                    # Replay install from history
│   ├── alias.ts                     # Server name aliases
│   ├── template.ts                  # Config templates
│   ├── notify.ts                    # Manage update notifications
│   ├── serve.ts                     # Expose mcpman as MCP server
│   ├── publish.ts                   # Publish servers to registry
│   ├── dashboard.ts                 # Start dashboard HTTP API
│   ├── skill.ts                     # Manage universal skills
│   ├── agent.ts                     # Sync agent configurations
│   └── team.ts                      # Team collaboration (RBAC)
├── core/                            # 56 core modules
│   ├── installer.ts                 # Package installation logic
│   ├── installer-vault-helpers.ts   # Vault integration utilities
│   ├── lockfile.ts                  # mcpman.lock parsing
│   ├── registry.ts                  # npm/Smithery registry client
│   ├── registry-search.ts           # Search + pagination
│   ├── registry-manager.ts          # Custom registry management
│   ├── mcpman-registry-client.ts    # Local registry HTTP client
│   ├── publish-service.ts           # Publish to registry
│   ├── server-resolver.ts           # Resolve npm/GitHub/plugin URLs
│   ├── server-inventory.ts          # Track installed servers
│   ├── server-updater.ts            # Version checking + updates
│   ├── health-checker.ts            # Runtime/env/process validation
│   ├── remote-installer.ts          # HTTP/SSE remote transport
│   ├── remote-health-checker.ts     # Remote server health checks
│   ├── diagnostics.ts               # Detailed health reports
│   ├── mcp-process-checks.ts        # Check running MCP processes
│   ├── mcp-tester.ts                # JSON-RPC validator
│   ├── vault-service.ts             # AES-256-CBC encrypted secrets
│   ├── security-scanner.ts          # OSV vulnerability scanning
│   ├── trust-scorer.ts              # Trust score computation
│   ├── sync-engine.ts               # Multi-client config sync
│   ├── config-service.ts            # ~/.mcpman/config.json CRUD
│   ├── config-diff.ts               # Sync change detection
│   ├── config-differ.ts             # Config diff utilities
│   ├── config-validator.ts          # Schema validation
│   ├── skill-service.ts             # Skill management (install/sync)
│   ├── skill-types.ts               # Skill interfaces + types
│   ├── agent-service.ts             # Agent config sync
│   ├── plugin-loader.ts             # npm plugin loading
│   ├── plugin-health-checker.ts     # Plugin diagnostics
│   ├── profile-service.ts           # Profile CRUD
│   ├── export-import-service.ts     # Bundle import/export
│   ├── package-info.ts              # Package metadata
│   ├── update-notifier.ts           # Update notifications (24h cache)
│   ├── version-checker.ts           # Version comparison utils
│   ├── scaffold-service.ts          # MCP server scaffolding
│   ├── link-service.ts              # Local server linking
│   ├── file-watcher-service.ts      # File watch + auto-reload
│   ├── why-service.ts               # Dependency reason tracing
│   ├── env-manager.ts               # Per-server env var management
│   ├── bench-service.ts             # Server performance benchmarking
│   ├── group-manager.ts             # Server group management
│   ├── pin-service.ts               # Version pinning
│   ├── rollback-service.ts          # Rollback to previous state
│   ├── history-service.ts           # Install/action history
│   ├── status-checker.ts            # Server status aggregation
│   ├── alias-manager.ts             # Server name alias management
│   ├── template-service.ts          # Config template management
│   ├── notify-service.ts            # Notification management
│   ├── completion-generator.ts      # Shell completion generation
│   ├── dashboard-api.ts             # Dashboard HTTP API
│   ├── team-service.ts              # Team collaboration CRUD
│   └── team-types.ts                # Team interfaces + roles
└── utils/                           # 3 utility modules
    ├── constants.ts                 # APP_NAME, APP_VERSION (1.0.0)
    ├── logger.ts                    # Logging utilities
    └── paths.ts                     # File path resolution

tests/
├── 49 test files               # 520+ test cases covering all commands
└── Test structure mirrors src/ (unit, integration, e2e)
```

## Command Categories

1. **Server Management:** install, list, remove, update, upgrade, rollback, pin
2. **Health & Diagnostics:** doctor, test, logs, audit, status, bench
3. **Configuration:** config, secrets, sync, profiles, diff, env, validate
4. **Discovery:** search, info, run, why
5. **Extensibility:** plugin, export, import, template
6. **Development:** create, link, watch, completions
7. **Organization:** group, alias, registry, notify, replay
8. **Initialization:** init

## Data Files

**~/.mcpman/**
- `config.json` — global config (defaultClient, updateCheckInterval, preferredRegistry, vaultTimeout, plugins)
- `vault.enc` — encrypted API keys/secrets (AES-256-CBC)
- `mcpman.lock` — current working directory lockfile (if `mcpman init` run)
- `plugins/` — npm-installed plugin packages
- `profiles/` — named server configs

**Client Config Paths:**
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- Claude Code CLI: `~/.claude/.mcp.json` (all platforms)
- Cursor: `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json` (macOS)
- VS Code: `~/Library/Application Support/Code/User/settings.json` (macOS)
- Windsurf: `~/Library/Application Support/Windsurf/User/globalStorage/windsurf.mcpConfigJson/mcp.json` (macOS)
- Roo Code: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json` (macOS)
- Codex CLI: `~/.codex/config.toml` (all platforms, TOML format)
- OpenCode: `~/.config/opencode/opencode.json` (all platforms)
- Continue: `~/.continue/config.yaml` (all platforms, YAML array format)
- Zed: `~/.config/zed/settings.json` (all platforms, `context_servers` key)

## Testing

**64 test files, 1123+ test cases**
Test structure mirrors `src/` organization. Covers unit, integration, and remote transport tests.

```bash
npm test           # watch mode
npm run test:run   # single run
npm run test:coverage  # with coverage
```

## Build & Release

```bash
npm run build      # tsup: outputs dist/index.cjs, index.mjs, index.d.ts
npm run lint:fix   # biome format
```

- Binary: `./dist/index.cjs` (npm bin field)
- Version bumped in `package.json` AND `src/utils/constants.ts`
- Website: `website/` directory deployed to Cloudflare Pages (https://mcpman.pages.dev/)
- CI/CD: 3 GitHub Actions workflows — `ci.yml`, `publish.yml`, `pages.yml`

## Key Decisions

1. **Binary Format:** `index.cjs` not `.mjs` — npm requires CJS for bin field
2. **Encryption:** AES-256-CBC + PBKDF2 for vault
3. **Multi-client:** All 10 clients detected auto; `--client` flag restricts
4. **Registry:** npm primary; Smithery for MCP-specific; GitHub via direct .git URLs
5. **Plugin Prefix:** e.g. `ollama:my-model` resolved via plugin's `resolve()` export

## Dependencies

**Runtime:** citty (CLI), @clack/prompts (interactive), picocolors (colors), nanospinner (spinners), @iarna/toml (TOML parsing for Codex CLI), yaml (YAML parsing for OpenCode + Continue)
**Dev:** TypeScript 5.7, biome 1.9 (linting + formatting), vitest 4, tsup 8

Node ≥20 required.
