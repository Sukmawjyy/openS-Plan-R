# Code Review — Phase 1: Claude Code + Roo Code Handlers

**Date:** 2026-03-05
**Reviewer:** code-reviewer agent
**Plan:** `plans/260305-mcpman-v2-new-clients-and-ecosystem/phase-01-new-clients-wave-1.md`

---

## Scope

- **Files reviewed:** 18 changed/created files
- **New handlers:** `src/clients/claude-code.ts`, `src/clients/roo-code.ts`
- **Core changes:** `types.ts`, `client-detector.ts`, `paths.ts`, 5 command files, 3 core files
- **Tests:** 2 new test files, 2 updated test files
- **Test count:** 608 passing, build clean, lint clean
- **Scout findings:** Hardcoded 4-client display maps and help text in untouched commands; `isInstalled()` detection boundary; duplicate path construction for roo-code win32/macOS

---

## Overall Assessment

Phase 1 is solidly implemented. Architecture is consistent: both new handlers correctly extend `BaseClientHandler`, delegate to `resolveConfigPath`, and require zero overrides since their config format is standard `mcpServers` JSON. The TypeScript exhaustiveness of the `switch` in `getClient()` and `resolveConfigPath()` gives strong compile-time guarantees against future regressions when new types are added.

Primary concern is a cluster of **medium-priority holdovers**: three files that were not part of the stated diff scope but contain stale 4-client references that will mislead users at runtime.

---

## Critical Issues

None.

---

## High Priority

### H1 — `installer.ts` hardcoded error message omits new clients

**File:** `src/core/installer.ts:45`

```typescript
p.log.info("Supported: Claude Desktop, Cursor, VS Code, Windsurf");
```

When zero AI clients are detected this message is shown. Claude Code and Roo Code users will see an incorrect list and believe they are unsupported. This is a user-facing correctness issue — the user may uninstall or give up.

**Fix:**
```typescript
p.log.info("Supported: Claude Desktop, Cursor, VS Code, Windsurf, Claude Code, Roo Code");
```

---

## Medium Priority

### M1 — `remove.ts` CLIENT_DISPLAY map and help text are 4-client only

**File:** `src/commands/remove.ts:8-13` and `src/commands/remove.ts:32`

```typescript
const CLIENT_DISPLAY: Record<string, string> = {
  "claude-desktop": "Claude",
  cursor: "Cursor",
  vscode: "VS Code",
  windsurf: "Windsurf",
  // missing: "claude-code" and "roo-code"
};
```

```typescript
description: "Target client (claude, cursor, vscode, windsurf)",
```

`clientDisplayName()` falls back to the raw type string via `?? type` so it degrades gracefully — `claude-code` and `roo-code` will render as their raw key strings rather than crashing. But the `--client` flag description misleads users, and the confirmation prompt for multi-client removal will show `"claude-code"` instead of `"Claude Code"`.

**Fix:** Add the two missing entries to `CLIENT_DISPLAY` and update the flag description string.

### M2 — `list.ts` CLIENT_DISPLAY map and flag description are stale

**File:** `src/commands/list.ts:103-108` and `src/commands/list.ts:21`

Identical issue to M1. `formatClients()` uses `?? c` as fallback so it won't break, but the output column and `--client` help text show old values.

**Fix:** Same pattern as M1.

### M3 — `roo-code` path construction duplicated for darwin and win32

**File:** `src/utils/paths.ts:120-151`

The darwin and win32 branches for `roo-code` are byte-for-byte identical — both use `appData` + the same `Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json` path. Since `getAppDataDir()` already handles the per-platform `APPDATA` vs `~/Library/Application Support` distinction, only one branch is needed.

```typescript
// Current — darwin and win32 branches are identical
case "roo-code":
  if (process.platform === "darwin") {
    return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
  }
  if (process.platform === "win32") {
    return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
  }
  return path.join(home, ".config", "Code", "User", "globalStorage", ...);
```

The win32 linux fallback is also wrong: it hardcodes `~/.config/Code/...` instead of using `appData` (which for linux already resolves to `XDG_CONFIG_HOME ?? ~/.config`). So the linux path is a string duplicate of what `path.join(appData, "Code", ...)` would produce — redundant but technically correct for linux only.

**Fix:** Collapse darwin + win32 into a single `appData`-based path:

```typescript
case "roo-code":
  // appData resolves correctly per platform; only linux needs special casing
  if (process.platform === "linux") {
    return path.join(
      process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
      "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json",
    );
  }
  return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
```

Or even simpler — since `getAppDataDir()` handles all three platforms correctly:

```typescript
case "roo-code":
  return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json");
```

This works because `getAppDataDir()` returns `~/.config` on Linux (via `XDG_CONFIG_HOME ?? ~/.config`), matching the current linux fallback path.

### M4 — `isInstalled()` for `roo-code` checks the `settings/` directory, not the extension root

**File:** `src/clients/base-client-handler.ts:44-46` (called by roo-code handler)

`isInstalled()` checks `path.dirname(getConfigPath())` which for roo-code resolves to:

```
~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/
```

That `settings/` directory only exists once Roo Code has been launched and written its config at least once. A freshly-installed Roo Code extension will have `rooveterinaryinc.roo-cline/` but not `settings/` inside it yet. This causes a false-negative for new installs where the user has never opened the MCP settings pane.

Contrast with Claude Code: `path.dirname("~/.claude/.mcp.json")` = `~/.claude/` which exists as soon as the CLI is installed, even before any MCP config is written. That is a better proxy for installation state.

**Fix option A** — check the extension root directory instead:
Override `isInstalled()` in `RooCodeHandler` to check `.../rooveterinaryinc.roo-cline/` rather than the `settings/` subdirectory.

**Fix option B** — keep current behaviour, document it as "detects configured Roo Code, not installed Roo Code" — acceptable if the team prefers lazy detection.

---

## Low Priority

### L1 — README.md and docs still reference 4 clients

`README.md:11,34,66,525`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/design-guidelines.md:62`, `docs/development-roadmap.md:12`, and `website/index.html` all describe mcpman as a 4-client tool. Phase 1 plan todo item `Update docs` is marked unchecked.

These are not runtime bugs but they will create confusion for new contributors and users until updated.

### L2 — `roo-code.test.ts` does not import `path` or `os` for config path assertion

`claude-code.test.ts:43` asserts the exact path:
```typescript
expect(configPath).toBe(path.join(os.homedir(), ".claude", ".mcp.json"));
```

`roo-code.test.ts:37-40` uses looser `toContain()` assertions and never asserts the full path. This is fine as a pragmatic choice since roo-code path is platform-conditional, but worth noting for consistency.

### L3 — `config-service.ts` comment example still uses only `"claude-desktop"`

`src/core/config-service.ts:17`:
```typescript
/** Default client to install/manage servers for (e.g. "claude-desktop") */
```

Trivial; update the JSDoc example to mention the expanded type set.

---

## Edge Cases Found by Scout

1. **`isInstalled()` false-negative for fresh Roo Code** — covered as M4 above.
2. **`alwaysAllow` field in Roo Code config** — `BaseClientHandler.fromClientConfig()` does `{ ...raw, mcpServers: config.servers }` which preserves all extra fields including `alwaysAllow`. Confirmed safe by the `roo-code.test.ts:135-154` "preserves non-mcpServers fields" test. No issue.
3. **Claude Code project-level `.mcp.json`** — the handler only manages the user-global `~/.claude/.mcp.json`. Project-level `.mcp.json` files are outside mcpman's scope (correct per the phase spec). No issue, but worth a comment in the handler or docs.
4. **Concurrent `addServer()` race across handlers** — `atomicWrite` (.tmp + rename) is used in `base-client-handler.ts` so concurrent writes to the same file are safe via OS rename atomicity. No issue.
5. **`clientDisplayName()` fallback in `remove.ts`** — gracefully returns raw type key as the label, so no crash. Documented as M1.

---

## Positive Observations

- **Handler design is minimal and correct.** Both new handlers are 17-line files that delegate fully to the base class. No unnecessary overrides.
- **`resolveConfigPath()` switch is exhaustive.** TypeScript will produce a compile error if a new `ClientType` variant is added without a corresponding path case.
- **Atomic write used throughout.** No config corruption window.
- **`roo-code.test.ts` tests field preservation** — the `alwaysAllow` / `customSetting` test covers a real Roo Code concern that the spec flagged as a security consideration.
- **Tests clearly name new client count: 6.** All affected test files use explicit `toHaveLength(6)` assertions.
- **Completion scripts updated correctly** — bash, zsh, and fish all inline `claude-code roo-code` in the `--client` completion list.
- **`config-validator.ts` uses `KnownClient` local type** rather than importing `ClientType`, keeping the validator self-contained and avoiding a circular dependency risk.

---

## Recommended Actions (Prioritized)

1. **[H1] Fix `installer.ts` line 45** — update the "Supported:" message to include Claude Code and Roo Code. 1-line change.
2. **[M1/M2] Update `CLIENT_DISPLAY` and flag descriptions in `remove.ts` and `list.ts`** — add `"claude-code": "Claude Code"` and `"roo-code": "Roo Code"` entries; update description strings.
3. **[M3] Collapse duplicate roo-code path branches in `paths.ts`** — darwin/win32 are identical; simplify to `appData`-based path only.
4. **[M4] Decide on roo-code `isInstalled()` detection strategy** — either override to check extension root dir, or document the "settings dir not yet created" edge case.
5. **[L1] Update docs and README** — mark Phase 1 plan docs todo as complete after updating `README.md`, website, and docs files.

---

## Metrics

- Type coverage: exhaustive (switch on `ClientType` in all critical paths)
- Test coverage: 608 tests pass; new handlers have 8 tests each covering properties, config path, isInstalled, readConfig, addServer, removeServer, and field preservation
- Linting: clean per report
- Hardcoded stale references found: 3 runtime-visible (`installer.ts`, `remove.ts`, `list.ts`) + several doc-level

---

## Unresolved Questions

1. **Roo Code detection strategy (M4):** Is checking `settings/` directory acceptable (only detects configured installs), or should we check the extension root? Affects first-run UX for new Roo Code users.
2. **Claude Code project-level `.mcp.json`:** Out of scope for Phase 1 per plan, but should there be a `--scope project|global` flag added in a future phase or noted in Phase 2?
3. **Plan status:** `phase-01-new-clients-wave-1.md` still shows `status: pending` and all todo checkboxes unchecked. Should the plan file be updated to reflect completion?
