import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { ContinueHandler } from "../../src/clients/continue-client.js";

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

vi.mock("yaml", () => ({
  default: {
    parse: vi.fn(),
    stringify: vi.fn(),
  },
}));

import YAML from "yaml";

describe("ContinueHandler", () => {
  let handler: ContinueHandler;

  beforeEach(() => {
    handler = new ContinueHandler();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct type", () => {
      expect(handler.type).toBe("continue");
    });

    it("has correct displayName", () => {
      expect(handler.displayName).toBe("Continue");
    });
  });

  describe("getConfigPath()", () => {
    it("returns path containing .continue and config.yaml", () => {
      const configPath = handler.getConfigPath();
      expect(configPath).toContain(".continue");
      expect(configPath).toContain("config.yaml");
    });
  });

  describe("isInstalled()", () => {
    it("returns true when ~/.continue directory exists", async () => {
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
      const result = await handler.isInstalled();
      expect(result).toBe(true);
    });

    it("returns false when ~/.continue directory does not exist", async () => {
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error("ENOENT"));
      const result = await handler.isInstalled();
      expect(result).toBe(false);
    });
  });

  describe("readConfig()", () => {
    it("converts mcpServers array to Record by name", async () => {
      const parsed = {
        mcpServers: [
          { name: "my-server", command: "npx", args: ["-y", "my-mcp"] },
        ],
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce("yaml content");
      vi.mocked(YAML.parse).mockReturnValueOnce(parsed);

      const config = await handler.readConfig();
      expect(config.servers).toHaveProperty("my-server");
      expect(config.servers["my-server"].command).toBe("npx");
      expect(config.servers["my-server"].args).toEqual(["-y", "my-mcp"]);
    });

    it("strips the name field from server entries", async () => {
      const parsed = {
        mcpServers: [
          { name: "srv", command: "node", args: ["s.js"] },
        ],
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce("yaml content");
      vi.mocked(YAML.parse).mockReturnValueOnce(parsed);

      const config = await handler.readConfig();
      expect(config.servers["srv"]).not.toHaveProperty("name");
    });

    it("returns empty servers when file does not exist", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(err);

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });

    it("returns empty servers when mcpServers key is missing", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce("yaml content");
      vi.mocked(YAML.parse).mockReturnValueOnce({ name: "my-config", version: "1" });

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });
  });

  describe("addServer()", () => {
    it("converts servers Record back to mcpServers array format", async () => {
      const existingParsed = { mcpServers: [] };
      vi.mocked(fs.promises.readFile).mockResolvedValue("yaml");
      vi.mocked(YAML.parse).mockReturnValue(existingParsed);
      vi.mocked(YAML.stringify).mockReturnValue("mcpServers:\n  - name: new-server\n");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new-server", { command: "npx", args: ["-y", "pkg"] });

      expect(YAML.stringify).toHaveBeenCalled();
      const stringifyArg = vi.mocked(YAML.stringify).mock.calls[0][0] as Record<string, unknown>;
      const mcpServers = stringifyArg.mcpServers as Array<{ name: string; command: string }>;
      expect(Array.isArray(mcpServers)).toBe(true);
      const entry = mcpServers.find((s) => s.name === "new-server");
      expect(entry).toBeDefined();
      expect(entry?.command).toBe("npx");
    });
  });

  describe("removeServer()", () => {
    it("removes server from mcpServers array", async () => {
      const existingParsed = {
        mcpServers: [
          { name: "keep", command: "node", args: ["keep.js"] },
          { name: "remove", command: "node", args: ["remove.js"] },
        ],
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue("yaml");
      vi.mocked(YAML.parse).mockReturnValue(existingParsed);
      vi.mocked(YAML.stringify).mockReturnValue("mcpServers:\n  - name: keep\n");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.removeServer("remove");

      const stringifyArg = vi.mocked(YAML.stringify).mock.calls[0][0] as Record<string, unknown>;
      const mcpServers = stringifyArg.mcpServers as Array<{ name: string }>;
      const names = mcpServers.map((s) => s.name);
      expect(names).toContain("keep");
      expect(names).not.toContain("remove");
    });
  });

  describe("preserves other YAML keys", () => {
    it("does not overwrite non-mcpServers config properties", async () => {
      const existingParsed = {
        name: "my-continue-config",
        version: "1.0",
        mcpServers: [],
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue("yaml");
      vi.mocked(YAML.parse).mockReturnValue(existingParsed);
      vi.mocked(YAML.stringify).mockReturnValue("yaml output");
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new", { command: "test" });

      const stringifyArg = vi.mocked(YAML.stringify).mock.calls[0][0] as Record<string, unknown>;
      expect(stringifyArg.name).toBe("my-continue-config");
      expect(stringifyArg.version).toBe("1.0");
    });
  });
});
