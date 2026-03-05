# Tester Agent Memory — mcpman project

## Project: openS-Plan-R (mcpman)

**Location:** `/Users/tranhoangtu/Desktop/WORK/openS-Plan-R`
**Test runner:** vitest (v4.0.18) — run with `npx vitest run`
**Lang:** TypeScript ESM, `"type": "module"` in package.json

## Test Patterns

### Module mocking
- Use `vi.mock("../../src/core/module.js")` before imports
- Import mocked functions AFTER the `vi.mock()` call, then `vi.mocked(fn)` to type
- Module paths must include `.js` extension (ESM)

### Global fetch mocking
```ts
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
// Restore in afterEach: vi.unstubAllGlobals()
```

### Temp directories (fs-based tests)
```ts
let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-test-")); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
```

### HTTP server tests (dashboard-api)
- Use `server.listen(0)` (port 0) for OS-assigned port
- `server.address() as { port: number }` to get the port
- Module-level caches (health, audit) persist across tests in same run
  - Do NOT write tests that assume fresh cache state for 2nd+ calls
  - Test cache behavior by verifying 200 returns from cached endpoint

## Test File Locations
```
tests/core/mcpman-registry-client.test.ts  — 32 tests
tests/core/publish-service.test.ts         — 30 tests
tests/core/dashboard-api.test.ts           — 32 tests
tests/core/team-service.test.ts            — 69 tests
```

## Total test count
- Phase 7–9 added: 163 tests across 4 new files
- Full suite: 1224 tests across 65 files (as of Phase 9)

## Known Issues
- `tests/commands/secrets-command.test.ts`: stderr output from error-path tests
  looks like failures but all 12 tests actually pass — it's intentional console output
