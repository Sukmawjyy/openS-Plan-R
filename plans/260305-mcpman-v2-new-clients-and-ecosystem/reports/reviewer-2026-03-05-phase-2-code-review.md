# Code Review — Phase 2: Codex CLI + OpenCode + Continue + Zed Handlers

**Date:** 2026-03-05
**Reviewer:** code-reviewer agent
**Plan:** `plans/260305-mcpman-v2-new-clients-and-ecosystem/phase-02-new-clients-wave-2.md`

---

## Scope

- **Files reviewed:** 4 new handlers, updated `types.ts`, `paths.ts`, `client-detector.ts`, `config-validator.ts`, `installer.ts`, `completion-generator.ts`, `why-service.ts`, `sync.ts`, `diff.ts`, `link.ts`, `remove.ts`, `list.ts`; 4 new test files + `client-detector.test.ts` + `why-command.test.ts`
- **New handlers:** `codex-cli.ts` (TOML), `opencode.ts` (JSON+adapter), `continue-client.ts` (YAML+array), `zed.ts` (JSON)
- **New deps:** `@iarna/toml ^2.2.5`, `yaml ^2.8.2`
- **Test count:** 655 passing, build clean, lint clean
- **Scout findings:** `config-validator.ts` blindly JSON-parses TOML/YAML client configs; OpenCode path used `home` not `appData` losing cross-platform parity; `config.yaml`→missing server name edge case in Continue; OpenCode `command` empty-array edge case

---

## Overall Assessment

Phase 2 delivers four well-structured handlers with consistent patterns, thorough test coverage, and zero regressions on the existing six clients. The architecture scales correctly: TOML and YAML handlers override only `readRaw`/`writeRaw` while reusing the full `BaseClientHandler` lifecycle; OpenCode and Continue override only the mapping layer. Downstream files (`sync`, `diff`, `install`, `list`, `remove`, `why-service`, `completion-generator`) are all consistently updated.

Two correctness bugs require attention before this ships — one in `config-validator.ts` that will misreport TOML/YAML client configs as invalid JSON, and one in `opencode.ts` where a zero-length `command` array will produce a broken `ServerEntry`.

---

## Critical Issues

None — no security vulnerabilities, no data loss paths, no breaking changes to existing clients.

---

## High Priority

### 1. `config-validator.ts` — blindly JSON-parses TOML and YAML client configs

**File:** `src/core/config-validator.ts`, lines 105–110 and `validateAll()` lines 153–164

**Problem:** `validateClientConfig()` reads any client config file and calls `JSON.parse()` unconditionally. For `codex-cli` (TOML) and `continue` (YAML), this always throws and returns `{ valid: false, errors: ["Invalid JSON"] }` — a false-positive failure. `validateAll()` will then surface these as broken configs on any machine where either client is installed.

```typescript
// line 107 — will throw on ~/.codex/config.toml and ~/.continue/config.yaml
data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
```

**Impact:** `mcpman validate` reports two healthy clients as broken. Users running `mcpman doctor` may take destructive action on a valid config.

**Fix:** Either skip TOML/YAML clients in `validateClientConfig` (simplest), or route through the handler's `readConfig()`. Simplest safe fix:

```typescript
// In validateClientConfig(), before JSON.parse:
const SKIP_JSON_CLIENTS = ["codex-cli", "continue"];
if (SKIP_JSON_CLIENTS.includes(clientName)) {
  // These use non-JSON formats; structural validation not supported here
  return { file: filePath, valid: true, errors: [] };
}
```

Alternatively, pass the validation responsibility to each handler by adding a `validateConfig(): Promise<ValidationResult>` method to `ClientHandler`.

---

### 2. `opencode.ts` — empty `command` array produces `command: ""`

**File:** `src/clients/opencode.ts`, `toClientConfig()`, line 24

**Problem:** OpenCode stores the binary as the first element of `command: [...]`. If an entry has an empty `command` array (e.g. a partially written config or a server added by another tool), `cmdArray[0] ?? ""` silently produces `command: ""` in the `ServerEntry`. The `ServerEntry` interface requires `command: string` and downstream consumers (`health-checker`, `run`, `test`) will attempt to spawn an empty string, producing a confusing process error.

```typescript
// current
command: cmdArray[0] ?? "",
```

**Fix:** Emit a warning or skip the entry entirely when `cmdArray` is empty:

```typescript
if (cmdArray.length === 0) {
  // Emit debug log; skip server to avoid spawning empty command
  continue;
}
servers[name] = {
  command: cmdArray[0],
  args: cmdArray.slice(1),
  ...(entry.environment ? { env: entry.environment as Record<string, string> } : {}),
};
```

---

## Medium Priority

### 3. `opencode.ts` — uses `home` path (not `appData`) — inconsistent cross-platform behavior

**File:** `src/utils/paths.ts`, line 137

```typescript
case "opencode":
  return path.join(home, ".config", "opencode", "opencode.json");
```

On macOS, `home` is `~` and `.config` is a non-standard location. On Linux, `.config` is correct (`$XDG_CONFIG_HOME` or `~/.config`). On macOS the conventional location would be `~/Library/Application Support/opencode/opencode.json` (same pattern as Claude Desktop). However, OpenCode appears to be a cross-platform CLI tool that intentionally uses `~/.config` everywhere.

**Assessment:** This is acceptable if OpenCode's docs confirm the path is `~/.config/opencode/opencode.json` on all platforms. The comment in the file says it does, and this matches the plan. **Minor risk**: `getAppDataDir()` returns `~/Library/Application Support` on macOS, so a future developer may confuse these. Add a clarifying comment.

**Recommended action:** Add an explicit comment noting this intentionally bypasses `getAppDataDir()` because OpenCode uses `~/.config` cross-platform:

```typescript
case "opencode":
  // OpenCode uses ~/.config/opencode/ on all platforms (not platform appData dir)
  return path.join(home, ".config", "opencode", "opencode.json");
```

---

### 4. Plan says OpenCode uses YAML; implementation uses JSON

**File:** `plans/260305-mcpman-v2-new-clients-and-ecosystem/phase-02-new-clients-wave-2.md` (line 33) and `research/brainstorm-2026-03-05-mcpman-v2-roadmap.md` (line 61)

**Problem:** The plan/research originally said OpenCode uses `opencode.yaml` with YAML format + `mcpServers:` key. The completion summary (line 223) says "reads/writes `~/.config/opencode/opencode.json` under `mcpServers:` key". But the actual implementation uses `opencode.json` with `mcp` key and JSON format with `command: [...]` array and `environment` field — not the plan's `mcpServers:` YAML spec.

**Assessment:** The actual implementation is likely correct (based on real OpenCode behavior with `mcp` JSON key). The plan itself appears to have been corrected during implementation. No code action needed, but the plan file's "Key Insights" section (lines 31–35) should be updated to reflect the actual format to avoid confusion for future phases.

---

### 5. `continue-client.ts` — duplicate server name causes silent overwrite

**File:** `src/clients/continue-client.ts`, `toClientConfig()`, lines 43–48

**Problem:** Continue's YAML uses an array where `name` is a field. If the user has two entries with the same `name` in `mcpServers:`, the second silently overwrites the first during array→Record conversion:

```typescript
for (const entry of mcpArray) {
  const { name, ...rest } = entry;
  servers[name] = rest; // second duplicate silently overwrites first
}
```

**Impact:** Data loss — users who have duplicate-named entries (misconfigured or manually edited configs) will lose one silently on read-then-write cycles.

**Fix:** Detect and warn (or skip the duplicate):

```typescript
for (const entry of mcpArray) {
  const { name, ...rest } = entry;
  if (name in servers) {
    // Log a warning; keep first occurrence
    continue;
  }
  servers[name] = rest;
}
```

---

### 6. `config-validator.ts` — `KnownClient` type is a manual copy of `ClientType`

**File:** `src/core/config-validator.ts`, lines 78–88

The local `KnownClient` type is a manually maintained copy of `ClientType` from `types.ts`. This is noted in memory as an architectural decision to avoid circular deps. However, the `validateAll()` function (line 153) also manually lists all 10 clients — this is a third maintenance surface alongside `getAllClientTypes()` in `client-detector.ts`.

**Recommended action:** If circular deps are the blocker, extract `ClientType` into a separate `src/clients/client-type.ts` with zero other imports, then import it from both `types.ts` and `config-validator.ts`. This eliminates the duplicated list without the circular dependency.

This is low urgency since all three lists are currently in sync, but it is a drift risk.

---

## Low Priority

### 7. Test coverage gaps

**`codex-cli.test.ts`:** No test for non-ENOENT read errors (e.g. permission denied or malformed TOML). The test at line 83 covers ENOENT correctly. A test for `TOML.parse` throwing should be added to confirm `ConfigParseError` is thrown rather than swallowed.

**`opencode.test.ts`:** No test for empty `command` array (edge case from issue #2 above).

**`continue-client.test.ts`:** No test for duplicate `name` in `mcpServers` array.

**`zed.test.ts`:** No test for a non-ENOENT read error (permission denied path). Good coverage otherwise.

---

### 8. `opencode.ts` — `enabled: true` injected on write, not reflected on read

**File:** `src/clients/opencode.ts`, `fromClientConfig()`, line 40

When writing back to OpenCode config, the handler adds `enabled: true` to every server. But on read (`toClientConfig()`), the `enabled` field is ignored entirely and does not propagate to `ServerEntry`. This is correct behavior (ServerEntry has no `enabled` field), but it means:

- If OpenCode has `enabled: false` on a server, mcpman will overwrite it to `true` on any `addServer`/`removeServer` cycle on an unrelated server (because `writeConfig` rewrites all servers)
- Users who disabled a server in OpenCode will find it re-enabled after any mcpman operation

**Fix:** Preserve the `enabled` field from the original entry when writing back:

```typescript
mcp[name] = {
  type: "local",
  command: [entry.command, ...(entry.args ?? [])],
  enabled: (existingEntry?.enabled as boolean | undefined) ?? true,
  ...(entry.env ? { environment: entry.env } : {}),
};
```

This requires threading `existingRaw` through or reading it before the write. The simpler fix is to not inject `enabled` at all and let OpenCode use its own default — but that changes existing behavior if any entries were written without it.

---

### 9. `paths.ts` — `vscode` case is platform-redundant

**File:** `src/utils/paths.ts`, lines 104–112 (pre-existing, not introduced by Phase 2)

The `vscode` case has identical branches for `darwin` and `win32` before falling through to the else branch. This is a pre-existing issue unrelated to Phase 2 but worth noting.

---

## Edge Cases Found by Scout

1. **`config-validator.ts` JSON-parses TOML/YAML** — confirmed as High Priority issue #1 above
2. **`opencode.ts` empty command array** — confirmed as High Priority issue #2 above
3. **Continue duplicate server name** — confirmed as Medium Priority issue #5 above
4. **`enabled: false` overwritten by mcpman on OpenCode** — confirmed as Low Priority issue #8 above
5. **Cross-platform OpenCode path** — confirmed as Medium Priority issue #3 above (risk is low, path is correct)

---

## Positive Observations

- **Architecture consistency.** All four handlers follow the override-only-what-you-need pattern established in Phase 1. TOML/YAML handlers cleanly override `readRaw`/`writeRaw`; OpenCode and Continue cleanly override only the mapping layer. No code duplication.
- **Atomic writes throughout.** All four handlers use `atomicWrite()` for write safety. TOML and YAML handlers correctly catch and re-throw as `ConfigWriteError`.
- **Test quality.** All four test files use `vi.mock("node:fs")` with the promises API, matching the established pattern. Tests cover: type/name identity, path content, isInstalled true/false, empty config, ENOENT, format-specific conversions, preserve-other-fields, addServer, removeServer. Good coverage density.
- **No TypeScript escape hatches abused.** The only casts are at format boundaries (`as TOML.JsonMap`, `as Record<string, unknown>`) which are justified by the library's type constraints.
- **`getAllClientTypes()` and `resolveConfigPath()` switch exhaustiveness** maintained — adding a new ClientType without updating both will produce a compile error.
- **`client-detector.test.ts` updated** correctly to cover all 10 clients including the four new ones.
- **No secrets, credentials, or sensitive data** introduced.

---

## Recommended Actions

1. **[High]** Fix `config-validator.ts` to skip JSON parsing for `codex-cli` and `continue` clients — avoids false-positive validation failures in `mcpman validate` and `mcpman doctor`
2. **[High]** Fix `opencode.ts` `toClientConfig()` to skip or error on empty `command` array instead of producing `command: ""`
3. **[Medium]** Fix `continue-client.ts` to detect and skip (with warning) duplicate server names on array→Record conversion
4. **[Medium]** Add clarifying comment to `paths.ts` explaining OpenCode intentionally uses `~/.config` cross-platform, bypassing `getAppDataDir()`
5. **[Low]** Investigate `enabled` field preservation for OpenCode — decide whether to preserve on round-trip or explicitly document the overwrite behavior
6. **[Low]** Add missing test cases: non-ENOENT errors for Codex/Zed, empty command array for OpenCode, duplicate name for Continue
7. **[Low]** Update plan "Key Insights" for OpenCode to reflect actual format (JSON `mcp` key with `command: [...]`)

---

## Metrics

- **Type Coverage:** 100% — no `any` usage; all casts are justified at library boundaries
- **Test Coverage:** High — all handlers have identity, path, isInstalled, readConfig (empty/ENOENT/populated), addServer, removeServer, and preserve-fields tests
- **Linting Issues:** 0 (lint clean per task description)
- **Handler pattern compliance:** 4/4 new handlers correctly extend `BaseClientHandler`

---

## Unresolved Questions

1. **OpenCode actual config format:** The research doc does not include an OpenCode section; the format used (`mcp` key, `command: [...]` array, `environment` field, `type: "local"`) appears correct based on opencode.ai behavior. Should be verified against latest OpenCode docs before Phase 3 ships any OpenCode-specific features.
2. **Zed `context_servers` schema:** Zed's MCP support is noted as experimental in the risk table. The `context_servers` key structure used here (`{ command, args, env }`) should be re-verified when Zed stabilizes its MCP API.
3. **Continue `config.json` legacy format:** Continue supports both `config.yaml` and `config.json`. The handler targets only `config.yaml`. Users who still use `config.json` will not be detected (`isInstalled()` checks the parent dir `~/.continue/` so they will appear installed, but `readConfig()` will get ENOENT and return empty). Should Phase 3 add a fallback read from `config.json`?
