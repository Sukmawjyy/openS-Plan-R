/**
 * agent-service.ts
 * Agent management logic — sync, list, and export agent configurations.
 * Works with the agent format registry to write client-specific agent files.
 */

import fs from "node:fs";
import path from "node:path";
import { getAgentFormatAdapter } from "../adapters/agent-format-registry.js";
import type { ClientType } from "../clients/types.js";
import { listSkills } from "./skill-service.js";
import type { AgentSpec, SkillSpec } from "./skill-types.js";

// ── Sync ───────────────────────────────────────────────────────────────────

/**
 * Sync agent specs to a specific client in the given project directory.
 * Writes client-specific agent config files using the format adapter.
 *
 * @returns Array of file paths that were written
 */
export function syncAgentsToClient(
  clientType: ClientType,
  agents: AgentSpec[],
  projectDir: string,
): string[] {
  const adapter = getAgentFormatAdapter(clientType);
  if (!adapter) {
    throw new Error(`No agent format adapter available for client: ${clientType}`);
  }

  if (agents.length === 0) return [];

  const outputs = adapter.formatAgents(agents);
  const written: string[] = [];

  for (const { filename, content } of outputs) {
    const dest = path.join(projectDir, filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
    written.push(dest);
  }

  return written;
}

// ── List ───────────────────────────────────────────────────────────────────

/**
 * Extract agent specs from a skill spec.
 * Returns an empty array if the spec has no agents.
 */
export function listAgentsFromSpec(spec: SkillSpec): AgentSpec[] {
  return spec.agents ?? [];
}

/**
 * Collect all agents across all installed skills.
 * Later entries override earlier ones when names collide.
 */
export function listAllInstalledAgents(): AgentSpec[] {
  const skills = listSkills();
  const agentMap = new Map<string, AgentSpec>();

  for (const skill of skills) {
    for (const agent of listAgentsFromSpec(skill.spec)) {
      agentMap.set(agent.name, agent);
    }
  }

  return Array.from(agentMap.values());
}

// ── Export ─────────────────────────────────────────────────────────────────

/** Locations to scan when exporting existing agent configs */
const AGENT_SCAN_LOCATIONS = [{ dir: ".claude/agents", client: "claude-code" as const }];

/**
 * Scan a project directory for existing agent config files and build AgentSpec[].
 * Currently supports reading .claude/agents/*.md files (Claude Code format).
 *
 * @returns Array of AgentSpec objects found in the project
 */
export function exportAgents(projectDir: string): AgentSpec[] {
  const agents: AgentSpec[] = [];

  for (const loc of AGENT_SCAN_LOCATIONS) {
    const agentDir = path.join(projectDir, loc.dir);
    if (!fs.existsSync(agentDir)) continue;

    const entries = fs.readdirSync(agentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      try {
        const content = fs.readFileSync(path.join(agentDir, entry.name), "utf-8");
        const agent = parseClaudeAgentFile(entry.name.replace(/\.md$/, ""), content);
        if (agent) agents.push(agent);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return agents;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a Claude Code .claude/agents/{name}.md file into an AgentSpec.
 * Extracts YAML frontmatter and body content.
 */
function parseClaudeAgentFile(name: string, content: string): AgentSpec | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    // No frontmatter — treat entire content as role
    return { name, role: content.trim() };
  }

  const [, frontmatter, body] = frontmatterMatch;
  const agent: AgentSpec = { name, role: body.trim() };

  // Parse simple YAML key: value pairs from frontmatter
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "description") agent.description = value;
    if (key === "tools") {
      agent.tools = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return agent;
}
