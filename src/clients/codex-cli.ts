import fs from "node:fs";
import TOML from "@iarna/toml";
import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler, atomicWrite } from "./base-client-handler.js";
import type { ClientConfig, ClientType, ServerEntry } from "./types.js";
import { ConfigParseError, ConfigWriteError } from "./types.js";

/**
 * Codex CLI stores MCP config in TOML at ~/.codex/config.toml
 * Format: [mcp_servers.name] with command, args, env sub-table
 */
export class CodexCliHandler extends BaseClientHandler {
  type: ClientType = "codex-cli";
  displayName = "Codex CLI";

  getConfigPath(): string {
    return resolveConfigPath("codex-cli");
  }

  protected async readRaw(): Promise<Record<string, unknown>> {
    const configPath = this.getConfigPath();
    try {
      const raw = await fs.promises.readFile(configPath, "utf-8");
      return TOML.parse(raw) as unknown as Record<string, unknown>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new ConfigParseError(configPath, err);
    }
  }

  protected async writeRaw(data: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath();
    try {
      await atomicWrite(configPath, TOML.stringify(data as TOML.JsonMap));
    } catch (err) {
      throw new ConfigWriteError(configPath, err);
    }
  }

  protected toClientConfig(raw: Record<string, unknown>): ClientConfig {
    const mcpServers = (raw.mcp_servers ?? {}) as Record<string, ServerEntry>;
    return { servers: mcpServers };
  }

  protected fromClientConfig(
    raw: Record<string, unknown>,
    config: ClientConfig,
  ): Record<string, unknown> {
    return { ...raw, mcp_servers: config.servers };
  }
}
