/**
 * roo-code-agent-format.ts
 * Format adapter for Roo Code agents — generates .roomodes JSON file.
 * Agents are serialized as custom modes in the Roo Code format.
 *
 * Tool mapping:
 *   Read, Glob, Grep → "read"
 *   Edit, Write       → "edit"
 *   Bash              → "command"
 */

import type { AgentSpec } from "../../core/skill-types.js";

export interface FormatOutput {
  filename: string;
  content: string;
}

/** Maps mcpman tool names to Roo Code group names */
const TOOL_TO_GROUP: Record<string, string> = {
  Read: "read",
  Glob: "read",
  Grep: "read",
  Edit: "edit",
  Write: "edit",
  Bash: "command",
};

/** Maps an array of tool names to deduplicated Roo Code group names */
function toolsToGroups(tools: string[]): string[] {
  const groups = new Set<string>();
  for (const tool of tools) {
    const group = TOOL_TO_GROUP[tool];
    if (group) groups.add(group);
  }
  // Default to read if no mapping found
  if (groups.size === 0) groups.add("read");
  return Array.from(groups);
}

/** Roo Code custom mode shape */
interface RooCustomMode {
  slug: string;
  name: string;
  roleDefinition: string;
  groups: string[];
  description?: string;
}

/**
 * Formats agent specs into a single .roomodes file.
 * Returns one file containing all agents as a JSON customModes array.
 */
export function formatAgents(agents: AgentSpec[]): FormatOutput[] {
  if (agents.length === 0) return [];

  const customModes: RooCustomMode[] = agents.map((agent) => {
    const groups = agent.tools && agent.tools.length > 0 ? toolsToGroups(agent.tools) : ["read"];

    const mode: RooCustomMode = {
      slug: agent.name,
      name: agent.name,
      roleDefinition: agent.role,
      groups,
    };

    if (agent.description) {
      mode.description = agent.description;
    }

    return mode;
  });

  const content = `${JSON.stringify({ customModes }, null, 2)}\n`;

  return [{ filename: ".roomodes", content }];
}
