# mcpman System Architecture

**Version:** 2.0.0
**Last Updated:** 2026-03-05

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    mcpman CLI (index.ts)                          │
│                  43 subcommands via citty                         │
└────────────────────┬──────────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────────┬──────────────┐
    │                │                    │              │
    ▼                ▼                    ▼              ▼
┌────────┐       ┌─────────┐          ┌──────────┐  ┌────────┐
│Clients │       │Commands │          │Core Logic│  │MCP API │
└────────┘       └─────────┘          └──────────┘  └────────┘
    │                │                    │              │
10 AI clients    43 subcommands       56 modules    8 tools
    │                                     │              │
    ▼                                     ▼              ▼
┌────────────────┬──────────┬─────────┬──────────┐  ┌────────┐
│10 AI Client    │Lockfile  │Vault.enc│Dashboard │  │HTTP    │
│Configs (JSON   │JSON      │AES-256  │API       │  │/SSE    │
│/YAML/TOML)     │          │         │          │  │Events  │
└────────────────┴──────────┴─────────┴──────────┘  └────────┘
```

## Component Organization

### 1. CLI Entry Point (`src/index.ts`)

- citty framework for command routing and argument parsing
- 38 subcommands registered at startup
- Graceful SIGINT handling (Ctrl+C abort)

### 2. Client Handlers (`src/clients/`)

**Purpose:** Abstract platform-specific AI client config locations and schemas.

| File | Responsibility |
|------|----------------|
| `types.ts` | `ClientType` enum, `ConfigFile` interface |
| `base-client-handler.ts` | Abstract read/write/merge base |
| `claude-desktop.ts` | Claude Desktop macOS/Windows/Linux paths |
| `claude-code.ts` | Claude Code CLI (`~/.claude/.mcp.json`) |
| `cursor.ts` | Cursor IDE config integration |
| `vscode.ts` | VS Code settings.json integration |
| `windsurf.ts` | Windsurf IDE config integration |
| `roo-code.ts` | Roo Code VS Code extension globalStorage |
| `codex-cli.ts` | Codex CLI (`~/.codex/config.toml`, TOML format) |
| `opencode.ts` | OpenCode (`~/.config/opencode/opencode.json`) |
| `continue-client.ts` | Continue (`~/.continue/config.yaml`, YAML array format) |
| `zed.ts` | Zed (`~/.config/zed/settings.json`, `context_servers` key) |
| `client-detector.ts` | Auto-detect installed clients via path existence |

**Data Structure (Local/Stdio Transport):**
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": { "API_KEY": "secret" }
    }
  }
}
```

**Data Structure (Remote HTTP/SSE Transport):**
```json
{
  "mcpServers": {
    "my-remote-server": {
      "type": "http",
      "url": "https://api.example.com/mcp/",
      "headers": { "Authorization": "Bearer token" }
    },
    "my-sse-server": {
      "type": "sse",
      "url": "https://sse.example.com/events",
      "headers": { "X-Custom-Header": "value" }
    }
  }
}
```

### 3. Commands (`src/commands/`) — 43 subcommands

| Category | Commands |
|----------|---------|
| Server Lifecycle | install, list, remove, update, upgrade, rollback, pin |
| Health & Diagnostics | doctor, test, logs, audit, status, bench |
| Configuration | config, secrets, sync, profiles, diff, env, validate |
| Discovery | search, info, run, why |
| Extensibility | plugin, export, import, template |
| Development | create, link, watch, completions |
| Organization | group, alias, registry, notify, replay, init |
| Registry & Publishing | publish, serve |
| Skills | skill, agent |
| Team Collaboration | team, dashboard |

Each command uses citty's `defineCommand({ meta, args, async run({ args }) })` pattern.

### 4. Core Modules (`src/core/`) — 56 modules

**Registry & Resolution:**
`registry.ts` (npm + Smithery API), `server-resolver.ts` (npm/GitHub/plugin), `registry-search.ts` (pagination + dedup), `registry-manager.ts` (custom registries), `mcpman-registry-client.ts` (local registry HTTP client), `publish-service.ts` (publish servers to registry)

**Installation & Management:**
`installer.ts` (full install flow), `remote-installer.ts` (HTTP/SSE registration), `installer-vault-helpers.ts` (vault integration), `lockfile.ts` (parse/write with transport type), `server-inventory.ts` (enumerate installed), `server-updater.ts` (shared update logic)

**Security & Validation:**
`vault-service.ts` (AES-256-CBC + PBKDF2), `security-scanner.ts` (OSV API), `trust-scorer.ts` (0–100 score), `config-validator.ts` (JSON schema)

**Health & Diagnostics:**
`health-checker.ts` (runtime/env/permissions + HTTP health checks), `remote-health-checker.ts` (HTTP endpoint + SSE stream validation), `diagnostics.ts` (structured report), `mcp-process-checks.ts` (running processes), `mcp-tester.ts` (JSON-RPC validate via stdio/HTTP POST), `status-checker.ts` (aggregate status)

**Configuration & Sync:**
`config-service.ts` (`~/.mcpman/config.json`), `config-diff.ts` (drift detection), `config-differ.ts` (diff utilities), `sync-engine.ts` (multi-client sync)

**Skills & Agent Management (v2.0+):**
`skill-service.ts` (skill CRUD), `skill-types.ts` (skill interfaces), `agent-service.ts` (agent config sync)

**Plugins & Extensibility:**
`plugin-loader.ts` (load + resolve), `plugin-health-checker.ts` (registry validation)

**Profiles & Portability:**
`profile-service.ts` (`~/.mcpman/profiles/`), `export-import-service.ts` (full state bundle)

**Developer Tooling (v0.7+):**
`scaffold-service.ts`, `link-service.ts`, `file-watcher-service.ts`, `why-service.ts`, `completion-generator.ts`

**Advanced Management (v0.8+):**
`env-manager.ts`, `bench-service.ts`, `group-manager.ts`, `pin-service.ts`, `rollback-service.ts`, `history-service.ts`

**Automation (v0.9+):**
`alias-manager.ts`, `template-service.ts`, `notify-service.ts`

**Dashboard & APIs (v2.0+):**
`dashboard-api.ts` (HTTP API endpoints), `team-service.ts` (team CRUD), `team-types.ts` (team interfaces)

**Utilities:**
- `package-info.ts` — npm package metadata (cached)
- `update-notifier.ts` — 24h-cached update notifications
- `version-checker.ts` — semantic version comparison

### 5. Utils (`src/utils/`)

| File | Responsibility |
|------|----------------|
| `constants.ts` | `APP_NAME`, `APP_VERSION`, `APP_DESCRIPTION` |
| `logger.ts` | Colored output (picocolors) + spinners (nanospinner) |
| `paths.ts` | Cross-platform path resolution (`getMcpmanDir`, `getProfilesDir`, etc.) |

## Key Data Flows

### Install Flow
```
install <server>
  → server-resolver.resolve() → {name, version, source}
  → installer.install() → download + validate + extract
  → installer-vault-helpers → pre-fill env from vault
  → lockfile.update(server)
  → applySyncActions() → register in all 10 clients
  → health-checker.checkRuntime() → validate
```

### Audit Flow
```
audit [--fix] [--json]
  → security-scanner.scanPackage() per server → vulns
  → trust-scorer.compute() → score 0–100
  → if --fix: server-updater.update() → re-scan
```

### Sync Flow
```
sync [--dry-run] [--source <client>] [--remove]
  → config-diff.detectDrift() → {added, removed, changed}
  → if --dry-run: print preview + exit
  → applySyncActions() per client
  → if --remove: remove extras not in lockfile
```

## v2.0 Features (New)

### mcpman as MCP Server (`serve`)
```
mcpman serve [--port 8000]
  → start mcpman as MCP protocol server via JSON-RPC
  → 8 tools available: install, remove, list, search, audit, doctor, info, status
  → allows AI agents to manage servers directly
  → write protection: --allow-write flag required for install/remove
```

### Registry & Publishing (`publish`)
```
mcpman publish --registry <url> [--token <token>]
  → publish MCP server to community registry
  → registry entry with metadata + tarball upload
  → uses mcpman-registry-client.ts for HTTP communication
  → publish-service.ts handles versioning + checksums
```

### Dashboard API (`dashboard`)
```
mcpman dashboard [--port 3000]
  → start HTTP API for web-based UI
  → dashboard-api.ts exposes REST endpoints
  → real-time server health + config visualization
  → WebSocket support for live updates
```

### Team Collaboration (`team`)
```
mcpman team <subcommand>
  → 7 subcommands: init, add-member, remove-member, list, sync, export, invite
  → team-service.ts handles team CRUD + shared vault access
  → team-types.ts defines Team/Member/Role interfaces
  → RBAC: admin/maintainer/viewer roles
  → encrypted team vault for shared secrets
  → audit logging of team actions
```

## External APIs

| Service | Endpoint |
|---------|----------|
| npm search | `GET https://registry.npmjs.org/-/v1/search?text=X&size=N` |
| npm package | `GET https://registry.npmjs.org/{package-name}` |
| Smithery | `GET https://api.smithery.ai/api/packages?qualifiedName=X&pageSize=N` |
| OSV | `POST https://api.osv.dev/v1/query` |

## Error Handling

Graceful degradation — skip unavailable components rather than aborting:
- Missing client config → skip that client, warn user
- Vault locked and declined → skip secret injection, continue install
- Plugin registry unreachable → skip plugin results, return core results

Output: colored (red/yellow/green), spinners for long ops, `--json` for CI on all data commands.

## Security Model

1. AES-256-CBC + PBKDF2 vault — password-protected, auto-lock after configurable timeout
2. SHA-256 checksum per server binary in lockfile
3. Trust score (0–100) from OSV + npm metadata, surfaced during `info` and `install`
4. `audit --fix` for pre-deployment vulnerability remediation
5. Sync preserves non-MCP fields in each client config

## Testing

64 test files, 1123+ test cases — unit (vault, registry, lockfile, remote transport, skills, agents, team), integration (install → sync → audit → team), remote endpoint mocking, mock client configs for isolation.

```bash
npm run test:run
npm run test:run -- --coverage
```

## Deployment

- Binary: `./dist/index.cjs` (CJS — required for npm bin field)
- Version synced in `package.json` AND `src/utils/constants.ts`
- CI/CD: 3 GitHub Actions workflows in `.github/workflows/`:
  - `ci.yml` — lint + test on every push/PR (Node 20 + 22 matrix)
  - `publish.yml` — npm publish triggered by `v*` git tag
  - `pages.yml` — website deploy triggered by changes to `website/` on main
- Self-update: `mcpman upgrade` fetches latest via npm
- Website: https://mcpman.pages.dev/ — static HTML/CSS in `website/` dir, hosted on Cloudflare Pages
