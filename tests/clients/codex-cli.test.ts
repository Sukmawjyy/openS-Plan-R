import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { CodexCliHandler } from "../../src/clients/codex-cli.js";

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

vi.mock("@iarna/toml", () => ({
  default: {
    parse: vi.fn(),
    stringify: vi.fn(),
  },
}));

import TOML from "@iarna/toml";

describe("CodexCliHandler", () => {
  let handler: CodexCliHandler;

  beforeEach(() => {
    handler = new CodexCliHandler();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct type", () => {
      expect(handler.type).toBe("codex-cli");
    });

    it("has correct displayName", () => {
      expect(handler.displayName).toBe("Codex CLI");
    });
  });

  describe("getConfigPath()", () => {
    it("returns path containing .codex and config.toml", () => {
      const configPath = handler.getConfigPath();
      expect(configPath).toContain(".codex");
      expect(configPath).toContain("config.toml");
    });
  });

  describe("isInstalled()", () => {
    it("returns true when ~/.codex directory exists", async () => {
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
      const result = await handler.isInstalled();
      expect(result).toBe(true);
    });

    it("returns false when ~/.codex directory does not exist", async () => {
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error("ENOENT"));
      const result = await handler.isInstalled();
      expect(result).toBe(false);
    });
  });

  describe("readConfig()", () => {
    it("returns servers from mcp_servers key", async () => {
      const tomlString = '[mcp_servers.test-server]\ncommand = "node"\nargs = ["server.js"]';
      const parsed = {
        mcp_servers: {
          "test-server": { command: "node", args: ["server.js"] },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(tomlString);
      vi.mocked(TOML.parse).mockReturnValueOnce(parsed as TOML.JsonMap);

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

    it("returns empty servers when mcp_servers key is missing", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce("");
      vi.mocked(TOML.parse).mockReturnValueOnce({} as TOML.JsonMap);

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });
  });

  describe("addServer()", () => {
    it("adds server using mcp_servers key and writes atomically", async () => {
      const existingParsed = { mcp_servers: {} };
      vi.mocked(fs.promises.readFile).mockResolvedValue("");
      vi.mocked(TOML.parse).mockReturnValue(existingParsed as TOML.JsonMap);
      vi.mocked(TOML.stringify).mockReturnValue("[mcp_servers.new-server]\ncommand = \"npx\"\n");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new-server", { command: "npx", args: ["-y", "my-server"] });

      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(TOML.stringify).toHaveBeenCalled();
      const stringifyArg = vi.mocked(TOML.stringify).mock.calls[0][0] as Record<string, unknown>;
      expect(stringifyArg).toHaveProperty("mcp_servers");
      const mcpServers = stringifyArg.mcp_servers as Record<string, unknown>;
      expect(mcpServers).toHaveProperty("new-server");
    });
  });

  describe("removeServer()", () => {
    it("removes server from config", async () => {
      const existingParsed = {
        mcp_servers: {
          keep: { command: "node", args: ["keep.js"] },
          remove: { command: "node", args: ["remove.js"] },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue("");
      vi.mocked(TOML.parse).mockReturnValue(existingParsed as TOML.JsonMap);
      vi.mocked(TOML.stringify).mockReturnValue("[mcp_servers.keep]\n");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.removeServer("remove");

      expect(TOML.stringify).toHaveBeenCalled();
      const stringifyArg = vi.mocked(TOML.stringify).mock.calls[0][0] as Record<string, unknown>;
      const mcpServers = stringifyArg.mcp_servers as Record<string, unknown>;
      expect(mcpServers).toHaveProperty("keep");
      expect(mcpServers).not.toHaveProperty("remove");
    });
  });

  describe("preserves non-mcp_servers fields", () => {
    it("does not overwrite other config properties", async () => {
      const existingParsed = {
        mcp_servers: {},
        model: "o4-mini",
        notify: true,
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue("");
      vi.mocked(TOML.parse).mockReturnValue(existingParsed as TOML.JsonMap);
      vi.mocked(TOML.stringify).mockReturnValue("");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new", { command: "test" });

      const stringifyArg = vi.mocked(TOML.stringify).mock.calls[0][0] as Record<string, unknown>;
      expect(stringifyArg.model).toBe("o4-mini");
      expect(stringifyArg.notify).toBe(true);
    });
  });
});
