import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { OpenCodeHandler } from "../../src/clients/opencode.js";

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

describe("OpenCodeHandler", () => {
  let handler: OpenCodeHandler;

  beforeEach(() => {
    handler = new OpenCodeHandler();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct type", () => {
      expect(handler.type).toBe("opencode");
    });

    it("has correct displayName", () => {
      expect(handler.displayName).toBe("OpenCode");
    });
  });

  describe("getConfigPath()", () => {
    it("returns path containing opencode and opencode.json", () => {
      const configPath = handler.getConfigPath();
      expect(configPath).toContain("opencode");
      expect(configPath).toContain("opencode.json");
    });
  });

  describe("isInstalled()", () => {
    it("returns true when opencode config directory exists", async () => {
      vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
      const result = await handler.isInstalled();
      expect(result).toBe(true);
    });

    it("returns false when opencode config directory does not exist", async () => {
      vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error("ENOENT"));
      const result = await handler.isInstalled();
      expect(result).toBe(false);
    });
  });

  describe("readConfig()", () => {
    it("converts mcp command array to command+args", async () => {
      const configData = {
        mcp: {
          "test-server": {
            type: "local",
            command: ["npx", "-y", "my-pkg"],
            enabled: true,
          },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify(configData));

      const config = await handler.readConfig();
      expect(config.servers).toHaveProperty("test-server");
      expect(config.servers["test-server"].command).toBe("npx");
      expect(config.servers["test-server"].args).toEqual(["-y", "my-pkg"]);
    });

    it("converts mcp environment to env", async () => {
      const configData = {
        mcp: {
          "env-server": {
            type: "local",
            command: ["node", "server.js"],
            environment: { API_KEY: "secret", DEBUG: "1" },
          },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify(configData));

      const config = await handler.readConfig();
      expect(config.servers["env-server"].env).toEqual({ API_KEY: "secret", DEBUG: "1" });
    });

    it("returns empty servers when file does not exist", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(err);

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });

    it("returns empty servers when mcp key is missing", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify({}));

      const config = await handler.readConfig();
      expect(config.servers).toEqual({});
    });
  });

  describe("addServer()", () => {
    it("converts command+args back to command array with type:local", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ mcp: {} }));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new-server", { command: "npx", args: ["-y", "my-mcp"] });

      expect(fs.promises.writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcp["new-server"].type).toBe("local");
      expect(parsed.mcp["new-server"].command).toEqual(["npx", "-y", "my-mcp"]);
    });

    it("converts env to environment key", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ mcp: {} }));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("env-server", {
        command: "node",
        args: ["server.js"],
        env: { TOKEN: "abc" },
      });

      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcp["env-server"].environment).toEqual({ TOKEN: "abc" });
    });
  });

  describe("removeServer()", () => {
    it("removes server from mcp config", async () => {
      const existing = {
        mcp: {
          keep: { type: "local", command: ["node", "keep.js"], enabled: true },
          remove: { type: "local", command: ["node", "remove.js"], enabled: true },
        },
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.removeServer("remove");

      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcp).toHaveProperty("keep");
      expect(parsed.mcp).not.toHaveProperty("remove");
    });
  });

  describe("preserves non-mcp fields", () => {
    it("does not overwrite other config properties", async () => {
      const existing = {
        mcp: {},
        theme: "dark",
        autosave: true,
      };
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existing));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await handler.addServer("new", { command: "test" });

      const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.theme).toBe("dark");
      expect(parsed.autosave).toBe(true);
    });
  });
});
