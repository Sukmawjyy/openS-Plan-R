import { describe, expect, it, vi, beforeEach } from "vitest";

// Track mock isInstalled state per client type
const installedMap: Record<string, boolean> = {
  "claude-desktop": false,
  cursor: false,
  vscode: false,
  windsurf: false,
  "claude-code": false,
  "roo-code": false,
  "codex-cli": false,
  opencode: false,
  continue: false,
  zed: false,
};

function makeHandler(type: string, displayName: string, configPath: string) {
  return {
    type,
    displayName,
    isInstalled: vi.fn(async () => installedMap[type] ?? false),
    getConfigPath: vi.fn(() => configPath),
    readConfig: vi.fn(),
    writeConfig: vi.fn(),
    addServer: vi.fn(),
    removeServer: vi.fn(),
  };
}

vi.mock("../../src/clients/claude-desktop.js", () => ({
  ClaudeDesktopHandler: class { constructor() { return makeHandler("claude-desktop", "Claude Desktop", "/fake/claude/config.json"); } },
}));

vi.mock("../../src/clients/cursor.js", () => ({
  CursorHandler: class { constructor() { return makeHandler("cursor", "Cursor", "/fake/cursor/mcp.json"); } },
}));

vi.mock("../../src/clients/vscode.js", () => ({
  VSCodeHandler: class { constructor() { return makeHandler("vscode", "VS Code", "/fake/vscode/settings.json"); } },
}));

vi.mock("../../src/clients/windsurf.js", () => ({
  WindsurfHandler: class { constructor() { return makeHandler("windsurf", "Windsurf", "/fake/windsurf/mcp.json"); } },
}));

vi.mock("../../src/clients/claude-code.js", () => ({
  ClaudeCodeHandler: class { constructor() { return makeHandler("claude-code", "Claude Code", "/fake/claude-code/.mcp.json"); } },
}));

vi.mock("../../src/clients/roo-code.js", () => ({
  RooCodeHandler: class { constructor() { return makeHandler("roo-code", "Roo Code", "/fake/roo-code/mcp_settings.json"); } },
}));

vi.mock("../../src/clients/codex-cli.js", () => ({
  CodexCliHandler: class { constructor() { return makeHandler("codex-cli", "Codex CLI", "/fake/codex-cli/config.toml"); } },
}));

vi.mock("../../src/clients/opencode.js", () => ({
  OpenCodeHandler: class { constructor() { return makeHandler("opencode", "OpenCode", "/fake/opencode/opencode.json"); } },
}));

vi.mock("../../src/clients/continue-client.js", () => ({
  ContinueHandler: class { constructor() { return makeHandler("continue", "Continue", "/fake/continue/config.yaml"); } },
}));

vi.mock("../../src/clients/zed.js", () => ({
  ZedHandler: class { constructor() { return makeHandler("zed", "Zed", "/fake/zed/settings.json"); } },
}));

import {
  getAllClientTypes,
  getClient,
  getInstalledClients,
} from "../../src/clients/client-detector.js";

describe("client-detector", () => {
  beforeEach(() => {
    // Reset all to not installed
    for (const key of Object.keys(installedMap)) {
      installedMap[key] = false;
    }
    vi.clearAllMocks();
  });

  describe("getAllClientTypes()", () => {
    it("returns all ten supported client types", () => {
      const types = getAllClientTypes();
      expect(types).toHaveLength(10);
      expect(types).toContain("claude-desktop");
      expect(types).toContain("cursor");
      expect(types).toContain("vscode");
      expect(types).toContain("windsurf");
      expect(types).toContain("claude-code");
      expect(types).toContain("roo-code");
      expect(types).toContain("codex-cli");
      expect(types).toContain("opencode");
      expect(types).toContain("continue");
      expect(types).toContain("zed");
    });
  });

  describe("getClient()", () => {
    it("returns handler with type claude-desktop", () => {
      const handler = getClient("claude-desktop");
      expect(handler.type).toBe("claude-desktop");
    });

    it("returns handler with type cursor", () => {
      const handler = getClient("cursor");
      expect(handler.type).toBe("cursor");
    });

    it("returns handler with type vscode", () => {
      const handler = getClient("vscode");
      expect(handler.type).toBe("vscode");
    });

    it("returns handler with type windsurf", () => {
      const handler = getClient("windsurf");
      expect(handler.type).toBe("windsurf");
    });

    it("returns handler with type claude-code", () => {
      const handler = getClient("claude-code");
      expect(handler.type).toBe("claude-code");
    });

    it("returns handler with type roo-code", () => {
      const handler = getClient("roo-code");
      expect(handler.type).toBe("roo-code");
    });

    it("handler exposes getConfigPath()", () => {
      const handler = getClient("claude-desktop");
      expect(typeof handler.getConfigPath).toBe("function");
      expect(typeof handler.getConfigPath()).toBe("string");
    });
  });

  describe("getInstalledClients()", () => {
    it("returns empty array when no clients are installed", async () => {
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(0);
    });

    it("returns only claude-desktop when only it is installed", async () => {
      installedMap["claude-desktop"] = true;
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(1);
      expect(installed[0].type).toBe("claude-desktop");
    });

    it("returns multiple clients when several are installed", async () => {
      installedMap["claude-desktop"] = true;
      installedMap["cursor"] = true;
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(2);
      const types = installed.map((h) => h.type);
      expect(types).toContain("claude-desktop");
      expect(types).toContain("cursor");
    });

    it("returns all ten when all are installed", async () => {
      for (const key of Object.keys(installedMap)) {
        installedMap[key] = true;
      }
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(10);
    });

    it("returns only claude-code when only it is installed", async () => {
      installedMap["claude-code"] = true;
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(1);
      expect(installed[0].type).toBe("claude-code");
    });

    it("returns only roo-code when only it is installed", async () => {
      installedMap["roo-code"] = true;
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(1);
      expect(installed[0].type).toBe("roo-code");
    });

    it("returns mix of old and new clients", async () => {
      installedMap["claude-desktop"] = true;
      installedMap["claude-code"] = true;
      installedMap["roo-code"] = true;
      const installed = await getInstalledClients();
      expect(installed).toHaveLength(3);
      const types = installed.map((h) => h.type);
      expect(types).toContain("claude-desktop");
      expect(types).toContain("claude-code");
      expect(types).toContain("roo-code");
    });
  });
});
