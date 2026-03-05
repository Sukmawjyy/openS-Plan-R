import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ClaudeCodeHandler } from "../../src/clients/claude-code.js";

vi.mock("node:fs", () => ({
  default: {
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
    },
  },
}));

describe("ClaudeCodeHandler", () => {
  let handler: ClaudeCodeHandler;

  beforeEach(() => {
    handler = new ClaudeCodeHandler();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct type", () => {
      expect(handler.type).toBe("claude-code");
    });

    it("has correct displayName", () => {
      expect(handler.displayName).toBe("Claude Code");
    });
  });

  describe("getConfigPath()", () => {
    it("returns path ending with .claude/.mcp.json", () => {
      const configPath = handler.getConfigPath();
      expect(configPath).toContain(".claude");
      expect(configPath).toContain(".mcp.json");
      expect(configPath).toBe(path.join(os.homedir(), ".claude", ".mcp.json"));
    });
  });

  describe("isInstalled()", () => {
    it("returns true when ~/.claude directory exists", async () => {
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
      const result = await handler.isInstalled();
      expect(result).toBe(true);
    });

    it("returns false when ~/.claude directory does not exist", async () => {
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error("ENOENT"));
      const result = await handler.isInstalled();
      expect(result).toBe(false);
    });
  });

  describe("readConfig()", () => {
    it("returns servers from mcpServers key", async () => {
      const configData = {
        mcpServers: {
          "test-server": { command: "node", args: ["server.js"] },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify(configData));

      const config = await handler.readConfig();
      expect(config.servers).toHaveProperty("test-server");
      expect(config.servers["test-server"].command).toBe("node");
    });

    it("returns empty servers when file does not exist", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(err);

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });

    it("returns empty servers when mcpServers key is missing", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify({}));

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });
  });

  describe("addServer()", () => {
    it("adds server to config and writes atomically", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ mcpServers: {} }));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new-server", { command: "npx", args: ["-y", "my-server"] });

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcpServers["new-server"]).toEqual({
        command: "npx",
        args: ["-y", "my-server"],
      });
    });
  });

  describe("removeServer()", () => {
    it("removes server from config", async () => {
      const existing = {
        mcpServers: {
          keep: { command: "node", args: ["keep.js"] },
          remove: { command: "node", args: ["remove.js"] },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.removeServer("remove");

      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcpServers).toHaveProperty("keep");
      expect(parsed.mcpServers).not.toHaveProperty("remove");
    });
  });
});
