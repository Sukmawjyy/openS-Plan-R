/**
 * agent-format-registry.ts
 * Maps ClientType values to their agent format adapter.
 * Only clients that support native agent/mode definitions are included.
 *
 * Supported: claude-code (.claude/agents/*.md), roo-code (.roomodes), codex-cli (AGENTS.md)
 */

import type { ClientType } from "../clients/types.js";
import type { AgentSpec } from "../core/skill-types.js";
import * as claudeCodeAgentFormat from "./formats/claude-code-agent-format.js";
import * as codexAgentFormat from "./formats/codex-agent-format.js";
import * as rooCodeAgentFormat from "./formats/roo-code-agent-format.js";

/** Common interface all agent format adapters satisfy */
export interface AgentFormatAdapter {
  formatAgents(agents: AgentSpec[]): Array<{ filename: string; content: string }>;
}

/** Clients that support native agent/mode definitions */
const AGENT_SUPPORTED_CLIENTS = new Set<ClientType>(["claude-code", "roo-code", "codex-cli"]);

/** Returns true if the client supports agent config syncing */
export function clientSupportsAgents(clientType: ClientType): boolean {
  return AGENT_SUPPORTED_CLIENTS.has(clientType);
}

/**
 * Returns the agent format adapter for a given client type.
 * Returns null if the client does not support agent definitions.
 */
export function getAgentFormatAdapter(clientType: ClientType): AgentFormatAdapter | null {
  switch (clientType) {
    case "claude-code":
      return claudeCodeAgentFormat;

    case "roo-code":
      return rooCodeAgentFormat;

    case "codex-cli":
      return codexAgentFormat;

    // Clients without native agent support
    case "claude-desktop":
    case "cursor":
    case "vscode":
    case "windsurf":
    case "opencode":
    case "continue":
    case "zed":
      return null;
  }
}
