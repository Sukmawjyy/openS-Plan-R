# Code Reviewer Memory — mcpman

## Project Conventions

- **Handler pattern:** All client handlers extend `BaseClientHandler` (src/clients/base-client-handler.ts).
  Override only `type`, `displayName`, `getConfigPath()`. Format overrides via `toClientConfig`/`fromClientConfig`.
- **Config paths:** All resolved via `resolveConfigPath(ClientType)` in `src/utils/paths.ts` — exhaustive switch.
- **Atomic writes:** `atomicWrite()` (.tmp + rename) used everywhere. Config corruption not a concern.
- **ClientType union:** Expanding it is a "breaking change" requiring v2.0 per plan. TypeScript switch exhaustiveness enforces completeness.
- **Test pattern:** New handler tests use `vi.mock("node:fs")` with promises API mocked.

## Recurring Issues to Check

- **Stale client display maps:** `CLIENT_DISPLAY` duplicated in 4 files: `remove.ts`, `list.ts`, `sync.ts`, `diff.ts`. `VALID_CLIENTS` arrays in `sync.ts`, `diff.ts`. None derived from `ClientType` — must manually update all when clients change.
- **DRY violations in commands domain:** `loadVaultSecrets()` duplicated in run.ts, logs.ts, test-command.ts, watch.ts. `loadClients()` in update.ts and audit.ts. `pad()`/`truncate()` in 5+ files. See `plans/reports/review-commands-domain.md` for full list.
- **Critical bugs found (2026-03-05):** sync.ts exits 1 on dry-run (should be 0), pin.ts reads after write so re-pin message is dead code, install.ts restore only targets first client.
- **profiles.ts and registry.ts** use manual positional action + switch instead of citty subCommands. Inconsistent with all other multi-action commands.
- **Installer warning message:** `src/core/installer.ts:46` hardcodes supported client list as a string — must be manually updated.
- **Docs lag:** README.md, website/index.html, docs/ often lag behind code changes. Always check.
- **`isInstalled()` in BaseClientHandler** checks `path.dirname(getConfigPath())`. For clients where the config dir only exists after first launch (e.g. Roo Code `settings/`), this gives false-negatives on fresh installs.
- **`config-validator.ts` JSON-parses all client configs** — blindly calls `JSON.parse()` on any client file. TOML (codex-cli) and YAML (continue) configs will always fail as "Invalid JSON". Must skip or use format-aware parsing for non-JSON clients.
- **Non-JSON handlers:** Codex CLI (TOML via `@iarna/toml`) and Continue (YAML via `yaml`) override `readRaw`/`writeRaw`. OpenCode/Zed use default JSON readRaw but override mapping layer only.
- **OpenCode adapter edge cases:** `command` field is `string[]` in OpenCode format (not separate command+args). Empty array produces `command: ""` — guard against this. Also, `enabled` field is injected as `true` on write but not read back — will overwrite user's `enabled: false` setting.
- **Continue array→Record conversion:** duplicate `name` values silently overwrite. Guard needed.

## Key File Locations

- Client handlers: `src/clients/`
- Config paths: `src/utils/paths.ts`
- Client factory: `src/clients/client-detector.ts`
- Central type: `src/clients/types.ts` — `ClientType` union
- Plan dir: `plans/260305-mcpman-v2-new-clients-and-ecosystem/`
- Reports: `plans/260305-mcpman-v2-new-clients-and-ecosystem/reports/`

## Architectural Decisions

- Roo Code uses VS Code extension globalStorage (`rooveterinaryinc.roo-cline/settings/mcp_settings.json`) for global config, not `.roo/mcp.json` project file.
- Claude Code uses `~/.claude/.mcp.json` (user-global only); project-level `.mcp.json` is out of scope.
- `config-validator.ts` uses a local `KnownClient` type rather than importing `ClientType` to avoid circular deps.
- Codex CLI: `~/.codex/config.toml`, key `[mcp_servers.name]` with `command`, `args`, `env`.
- OpenCode: `~/.config/opencode/opencode.json` (uses `~/.config` on all platforms, not `appData`), key `mcp`, format `{ command: [...], type: "local", environment: {...} }`.
- Continue: `~/.continue/config.yaml`, key `mcpServers` as **array** `[{ name, command, args, env }]` — requires array↔Record conversion. Legacy `config.json` not handled.
- Zed: `~/.config/zed/settings.json`, key `context_servers` (not `mcpServers`). MCP support is experimental.
