/**
 * claude-code-agent-format.ts
 * Format adapter for Claude Code agents — generates .claude/agents/{name}.md files.
 * Each agent gets its own Markdown file with YAML frontmatter.
 *
 * Model mapping: fast → haiku, balanced → sonnet, powerful → opus
 */

import type { AgentSpec } from "../../core/skill-types.js";

export interface FormatOutput {
  filename: string;
  content: string;
}

/** Maps abstract model tiers to Claude-specific model IDs */
const MODEL_MAP: Record<NonNullable<AgentSpec["model"]>, string> = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-4-5",
  powerful: "claude-opus-4-5",
};

/**
 * Formats agent specs into .claude/agents/{name}.md files.
 * Returns one file per agent with YAML frontmatter.
 */
export function formatAgents(agents: AgentSpec[]): FormatOutput[] {
  return agents.map((agent) => {
    const frontmatterLines: string[] = ["---", `name: ${agent.name}`];

    if (agent.description) {
      frontmatterLines.push(`description: ${agent.description}`);
    }

    if (agent.model) {
      frontmatterLines.push(`model: ${MODEL_MAP[agent.model]}`);
    }

    if (agent.tools && agent.tools.length > 0) {
      frontmatterLines.push(`tools: [${agent.tools.join(", ")}]`);
    }

    if (agent.deniedTools && agent.deniedTools.length > 0) {
      frontmatterLines.push(`denied_tools: [${agent.deniedTools.join(", ")}]`);
    }

    frontmatterLines.push("---");

    const bodyParts: string[] = [agent.role.trim()];

    if (agent.instructions) {
      bodyParts.push("", agent.instructions.trim());
    }

    const content = [frontmatterLines.join("\n"), "", ...bodyParts, ""].join("\n");

    return {
      filename: `.claude/agents/${agent.name}.md`,
      content,
    };
  });
}
