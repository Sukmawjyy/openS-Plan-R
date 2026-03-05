import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { RooCodeHandler } from "../../src/clients/roo-code.js";

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

describe("RooCodeHandler", () => {
  let handler: RooCodeHandler;

  beforeEach(() => {
    handler = new RooCodeHandler();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct type", () => {
      expect(handler.type).toBe("roo-code");
    });

    it("has correct displayName", () => {
      expect(handler.displayName).toBe("Roo Code");
    });
  });

  describe("getConfigPath()", () => {
    it("returns path containing roo-cline and mcp_settings.json", () => {
      const configPath = handler.getConfigPath();
      expect(configPath).toContain("rooveterinaryinc.roo-cline");
      expect(configPath).toContain("mcp_settings.json");
    });
  });

  describe("isInstalled()", () => {
    it("returns true when Roo Code extension storage exists", async () => {
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
      const result = await handler.isInstalled();
      expect(result).toBe(true);
    });

    it("returns false when Roo Code extension storage does not exist", async () => {
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error("ENOENT"));
      const result = await handler.isInstalled();
      expect(result).toBe(false);
    });
  });

  describe("readConfig()", () => {
    it("returns servers from mcpServers key", async () => {
      const configData = {
        mcpServers: {
          "roo-server": { command: "npx", args: ["-y", "roo-mcp"] },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify(configData));

      const config = await handler.readConfig();
      expect(config.servers).toHaveProperty("roo-server");
      expect(config.servers["roo-server"].command).toBe("npx");
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

      await handler.addServer("new-server", {
        command: "npx",
        args: ["-y", "@anthropic/mcp-server"],
        env: { API_KEY: "test-key" },
      });

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcpServers["new-server"]).toEqual({
        command: "npx",
        args: ["-y", "@anthropic/mcp-server"],
        env: { API_KEY: "test-key" },
      });
    });
  });

  describe("removeServer()", () => {
    it("removes server from config and preserves others", async () => {
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

  describe("preserves non-mcpServers fields", () => {
    it("does not overwrite other config properties", async () => {
      const existing = {
        mcpServers: {},
        alwaysAllow: ["some-tool"],
        customSetting: true,
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new", { command: "test" });

      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.alwaysAllow).toEqual(["some-tool"]);
      expect(parsed.customSetting).toBe(true);
    });
  });
});
