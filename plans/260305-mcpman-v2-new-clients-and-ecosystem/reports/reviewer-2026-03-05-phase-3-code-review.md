# Code Review: Phase 3 — Remote MCP Transport

**Date:** 2026-03-05
**Reviewer:** code-reviewer
**Scope:** Remote HTTP/SSE transport support (new files + modifications)
**Focus:** Security, error handling, type safety, edge cases

---

## Scope

**New files (2):**
- `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-installer.ts` (47 lines)
- `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-health-checker.ts` (95 lines)

**Modified files (11):**
- `src/clients/types.ts` — ServerEntry + TransportType
- `src/core/lockfile.ts` — LockEntry transport/url fields
- `src/core/health-checker.ts` — Remote routing
- `src/core/mcp-tester.ts` — testRemoteMcpServer()
- `src/core/installer.ts` — installRemoteServer()
- `src/core/config-diff.ts` — reconstructServerEntry for remote
- `src/core/config-differ.ts` — type/url diff comparison
- `src/core/config-validator.ts` — VALID_TRANSPORTS, NON_JSON_CLIENTS
- `src/commands/install.ts` — --url, --name, --transport CLI
- `src/commands/test-command.ts` — Remote test routing
- `src/commands/list.ts` — [http]/[sse] transport indicator

**LOC changed:** ~350

---

## Overall Assessment

Clean, well-structured implementation. Remote transport follows existing patterns. Two new files are focused and under 100 lines each. However, there are several security, correctness, and edge-case issues that need attention before merge.

---

## Critical Issues

### C1. SSRF via Unrestricted URL — No Private Network Blocking

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-installer.ts` (line 24-33)
**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-health-checker.ts` (lines 19, 62)

`validateRemoteUrl()` only checks protocol (http/https). It allows `http://127.0.0.1`, `http://localhost`, `http://169.254.169.254` (cloud metadata), `http://[::1]`, and any internal network IP. The health checker and tester then make HTTP requests to these URLs.

This is an SSRF vector. A user (or a malicious lockfile) could probe internal services.

**Fix:**
```typescript
export function validateRemoteUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `Unsupported protocol: ${parsed.protocol}` };
    }
    // Block obvious private/internal addresses
    const host = parsed.hostname.toLowerCase();
    const privatePatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^\[?::1\]?$/,
      /^\[?fe80:/i,
      /^\[?fc00:/i,
      /^\[?fd/i,
    ];
    // Allow localhost in development; warn in production
    // For CLI tools this may be acceptable — document the risk at minimum.
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}
```

**Impact:** For a CLI tool, SSRF risk is lower than a web service (the user is running it locally). However, if `mcpman install` is run from a shared lockfile (CI, team setup), a malicious `url` in the lockfile could probe internal infra during `mcpman test --all`. **Recommend adding at least a warning for private IPs, or a `--allow-private` flag.**

### C2. No --header CLI Argument — Headers Cannot Be Set on Install

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/commands/install.ts`

`installRemoteServer()` accepts `headers` in its options, but the CLI `install` command has no `--header` arg. The `headers` field is always `undefined` when installing via CLI. This means authenticated remote MCP servers (requiring `Authorization` header) cannot be configured via `mcpman install --url`.

**Fix:** Add a `--header` argument:
```typescript
header: {
  type: "string",
  description: "HTTP header KEY:VAL for remote servers (can repeat)",
},
```
Then parse into `Record<string, string>` similarly to `parseEnvFlags`.

---

## High Priority

### H1. TypeScript Errors in `installer.ts` (5 errors)

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/installer.ts` (lines 77, 86, 146, 203, 212)

Five TS errors in the changed file:
- Lines 77, 203: `p.multiselect` called with 2 type args, expects 1
- Lines 86, 212: Incorrect type cast of multiselect result to `string[]`
- Line 146: `source.type` is `string` but `LockEntry.source` expects the literal union

These are **pre-existing errors** (the multiselect ones), but line 146 and the duplicate pattern at line 203/212 in `installRemoteServer` are new code copying the existing buggy pattern.

**Fix for line 146 (new code):**
```typescript
source: source.type as LockEntry["source"],
```

**Fix for lines 203/212 (new code):** Match whatever fix is applied to lines 77/86.

### H2. `restoreFromLockfile` Does Not Handle Remote Servers

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/commands/install.ts` (lines 83-117)

When running `mcpman install` (no args) to restore from lockfile, `restoreFromLockfile()` always calls `installServer(input, ...)` which expects a package name. For remote entries (`transport: "http"/"sse"`), this will fail — there is no package to resolve.

**Fix:**
```typescript
for (const [name, entry] of entries) {
  if (entry.transport === "http" || entry.transport === "sse") {
    await installRemoteServer({
      url: entry.url ?? entry.resolved,
      name,
      transport: entry.transport,
      client: entry.clients[0],
      yes: true,
    });
    continue;
  }
  // ... existing stdio restore logic
}
```

### H3. `config-validator.ts` Rejects Valid Remote Server Entries

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/config-validator.ts` (lines 151-163)

`validateClientConfig()` requires every `mcpServers` entry to have `command` (string) and `args` (array). Remote entries have neither — they have `type`, `url`, and optionally `headers`. Every remote server entry will produce two validation errors.

**Fix:**
```typescript
const e = entry as Record<string, unknown>;
const isRemote = e.type === "http" || e.type === "sse" || typeof e.url === "string";
if (isRemote) {
  if (!e.url || typeof e.url !== "string") {
    errors.push(`mcpServers.${name}: remote entry missing "url"`);
  }
} else {
  if (!("command" in e) || typeof e.command !== "string") {
    errors.push(`mcpServers.${name}: missing or invalid "command"`);
  }
  if (!("args" in e) || !Array.isArray(e.args)) {
    errors.push(`mcpServers.${name}: missing or invalid "args" (must be array)`);
  }
}
```

### H4. Lockfile Validation Requires `command`/`args` for Remote Entries

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/config-validator.ts` (line 19)

`REQUIRED_LOCK_FIELDS` includes `"command"` and `"args"`. Remote lockfile entries have `command: ""` and `args: []` (set in `installRemoteServer`), so they technically pass. But the semantic intent is wrong — for remote entries, `url` should be required instead. If someone manually edits the lockfile and removes `command`/`args` from a remote entry, validation fails misleadingly.

**Impact:** Medium-high. Confusing error messages for remote entries.

### H5. `entryDiffs` Does Not Compare `headers`

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/config-differ.ts` (lines 22-49)

`entryDiffs()` compares `command`, `args`, `env`, `type`, and `url` but not `headers`. If two clients have the same remote server with different authorization headers, `mcpman diff` will report no changes.

**Fix:** Add after line 47:
```typescript
const aHeaders = JSON.stringify(a.headers ?? {});
const bHeaders = JSON.stringify(b.headers ?? {});
if (aHeaders !== bHeaders) {
  diffs.push(`headers: ${aHeaders} → ${bHeaders}`);
}
```

---

## Medium Priority

### M1. `resolveTransport` Allows `explicit: "stdio"` Silently

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-installer.ts` (line 17)

```typescript
if (explicit && explicit !== "stdio") return explicit;
```

If a user passes `--transport stdio` with `--url`, the function silently ignores the explicit transport and auto-detects. This should either error ("stdio transport is not valid for remote URLs") or be documented.

### M2. `reconstructServerEntry` Drops `headers` for Remote Entries

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/config-diff.ts` (lines 27-32)

When reconstructing a remote entry from lockfile, only `type` and `url` are set. If the original entry had `headers`, they are lost. This means `mcpman sync` for remote servers with auth headers will produce entries that fail to authenticate.

**Fix:** Store headers in LockEntry or reconstruct from client config.

### M3. `testRemoteMcpServer` Missing `initialized` Notification

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/mcp-tester.ts` (lines 49-67)

Per MCP protocol, after receiving the initialize response, the client should send a `notifications/initialized` notification before making other requests. Both `testRemoteMcpServer` and `checkRemoteMcpHandshake` skip this step. Some strict MCP servers may reject `tools/list` without it.

### M4. `checkRemoteEndpoint` Uses GET, Some Servers May Only Accept POST

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-health-checker.ts` (line 19)

The health check sends GET, which is handled for 405 responses. However, some servers may return other status codes (e.g., 400 Bad Request for GET). The 405 handling is good but the health check might benefit from trying HEAD first (lighter) or accepting a broader set of "reachable" status codes.

### M5. No Tests for Remote Transport Code

No test files exist for `remote-installer.ts`, `remote-health-checker.ts`, or the remote paths in `mcp-tester.ts`, `health-checker.ts`, `config-diff.ts`, or `config-validator.ts`. Zero test coverage for Phase 3.

### M6. LockEntry `runtime: "node"` Hardcoded for Remote

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/installer.ts` (line 248)

Remote servers have `runtime: "node"` which is meaningless. Consider adding `"remote"` to the runtime union or making `runtime` optional.

---

## Low Priority

### L1. Duplicate `RemoteInstallOptions` Interface

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/remote-installer.ts` (line 8) and `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/core/installer.ts` (line 15)

Two separate `RemoteInstallOptions` interfaces with overlapping but different fields. The one in `installer.ts` has extra `clientFilter` and `yes` fields. Import and extend instead.

### L2. `list.ts` Client Description Outdated in Args

**File:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R/src/commands/list.ts` (line 22)

Description says "Filter by client (claude, cursor, vscode, windsurf)" — missing newer clients (claude-code, roo-code, codex-cli, opencode, continue, zed).

### L3. Inconsistent `clientInfo.version` in Test Payloads

- `remote-health-checker.ts` line 58: `version: "1.0.0"`
- `mcp-tester.ts` line 54 (remote): `version: "1.0.0"`
- `mcp-tester.ts` line 208 (stdio): `version: "0.6.0"`

Should use a single constant derived from `package.json`.

---

## Edge Cases Found by Scout

1. **Lockfile restore loop for remote entries (H2):** `mcpman install` with no args tries to resolve remote entries as npm packages — will crash or produce confusing errors.
2. **Config validator false positives (H3):** `mcpman validate` reports every remote server entry as invalid (missing command/args).
3. **Headers lost on sync (M2):** Round-trip through lockfile drops authentication headers for remote servers.
4. **`isRemote()` check via `!!config.url` (health-checker line 21):** A malformed stdio entry with a stray `url` field would be incorrectly routed to remote health checks. Prefer checking `type` field only.
5. **`server-inventory.ts` line 25 TS error:** `readConfig()` returns `ClientConfig` but is assigned to `Record<string, ServerEntry>`. Pre-existing error but affects remote entries that flow through this path.

---

## Positive Observations

- Clean file separation: `remote-installer.ts` and `remote-health-checker.ts` are well-scoped
- Abort controller with timeout on all fetch calls — good practice
- 405 status handling in health checker — thoughtful
- Transport auto-detection from URL suffix is pragmatic
- `NON_JSON_CLIENTS` skip in validator — addresses a known issue from Phase 2
- `VALID_TRANSPORTS` validation in lockfile — defense in depth
- Config-differ extended with type/url comparison — thorough

---

## Recommended Actions (Prioritized)

1. **[Critical] C2** — Add `--header` CLI arg or document that headers must be set manually
2. **[High] H2** — Fix `restoreFromLockfile` to route remote entries to `installRemoteServer`
3. **[High] H3** — Update client config validator to accept remote entry shape
4. **[High] H1** — Fix TS errors in `installer.ts` (at least the new code at lines 146, 203, 212)
5. **[High] H5** — Add `headers` comparison to `entryDiffs`
6. **[Medium] M2** — Store/restore headers through lockfile round-trip
7. **[Medium] M5** — Write tests for remote transport code paths
8. **[Medium] M1** — Error on `--transport stdio` with `--url`
9. **[Low] L1** — Deduplicate `RemoteInstallOptions` interface
10. **[Low] L3** — Centralize clientInfo version constant

---

## Metrics

- **Type Coverage:** Build has 5 TS errors in changed file (`installer.ts`); 9 pre-existing in other files
- **Test Coverage:** 0% for new remote code paths — no test files found
- **Linting Issues:** 0 lint errors in changed files (56 total are in vendor/unrelated files)

---

## Unresolved Questions

1. Should mcpman restrict remote URLs to public addresses only (SSRF concern), or is the CLI context sufficient mitigation?
2. Should `headers` be stored in the lockfile (they may contain secrets like Bearer tokens)?
3. Should `--transport stdio` with `--url` be an error or silently ignored?
4. How should `mcpman sync` handle remote entries with auth headers that are not in the lockfile?
