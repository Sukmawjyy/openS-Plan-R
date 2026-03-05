import { resolveConfigPath } from "../utils/paths.js";
import { BaseClientHandler } from "./base-client-handler.js";
import type { ClientConfig, ClientType, ServerEntry } from "./types.js";

/**
 * Zed stores MCP config in JSON at ~/.config/zed/settings.json
 * Format: { "context_servers": { "name": { "command": "...", "args": [...], "env": {...} } } }
 */
export class ZedHandler extends BaseClientHandler {
  type: ClientType = "zed";
  displayName = "Zed";

  getConfigPath(): string {
    return resolveConfigPath("zed");
  }

  protected toClientConfig(raw: Record<string, unknown>): ClientConfig {
    const contextServers = (raw.context_servers ?? {}) as Record<string, ServerEntry>;
    return { servers: contextServers };
  }

  protected fromClientConfig(
    raw: Record<string, unknown>,
    config: ClientConfig,
  ): Record<string, unknown> {
    return { ...raw, context_servers: config.servers };
  }
}
