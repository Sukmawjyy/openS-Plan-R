/**
 * skill-types.ts
 * Type definitions for the universal mcpman-skill.json spec.
 * Skills bundle coding rules + optional MCP server configurations.
 */

/** A single coding rule that maps to each tool's native format */
export interface SkillRule {
  /** Unique rule identifier within the skill */
  name: string;
  /** Human-readable description of what this rule covers */
  description?: string;
  /** Glob patterns for scoping this rule (used by Cursor frontmatter) */
  globs?: string[];
  /** Whether this rule always applies regardless of active file (Cursor) */
  alwaysApply?: boolean;
  /** Markdown content of the rule */
  content: string;
}

/** MCP server bundled with a skill */
export interface SkillMcpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Universal skill specification — stored as mcpman-skill.json */
export interface SkillSpec {
  /** Skill identifier (e.g. "react-patterns" or "@community/react-patterns") */
  name: string;
  /** Semantic version string */
  version: string;
  /** Optional human-readable description */
  description?: string;
  /** One or more coding rules included in this skill */
  rules: SkillRule[];
  /** Optional MCP servers that complement the skill's rules */
  mcp_servers?: SkillMcpServer[];
  /** Optional agent/mode definitions bundled with this skill */
  agents?: AgentSpec[];
}

/** Metadata for a skill that has been installed to ~/.mcpman/skills/ */
export interface InstalledSkill {
  /** Full spec loaded from mcpman-skill.json */
  spec: SkillSpec;
  /** ISO timestamp of when the skill was installed */
  installedAt: string;
  /** Absolute path to the skill directory on disk */
  path: string;
}

/** Universal agent/mode definition that can be synced to multiple clients */
export interface AgentSpec {
  /** Unique identifier for this agent (kebab-case) */
  name: string;
  /** Human-readable description */
  description?: string;
  /** System prompt / role definition for this agent */
  role: string;
  /** Tools this agent is allowed to use */
  tools?: string[];
  /** Tools this agent is explicitly denied */
  deniedTools?: string[];
  /** Abstract model tier mapping to client-specific model IDs */
  model?: "fast" | "balanced" | "powerful";
  /** File patterns this agent is scoped to */
  filePatterns?: string[];
  /** Additional instructions beyond the role definition */
  instructions?: string;
}
