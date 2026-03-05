/**
 * team-types.ts
 * Type definitions for mcpman team collaboration features.
 * Team configs are stored in .mcpman/team.json in the project root (git-tracked).
 */

export type TeamRole = "admin" | "member" | "viewer";

export interface TeamMember {
  name: string;
  role: TeamRole;
  addedAt: string;
}

export interface TeamConfig {
  name: string;
  members: TeamMember[];
  servers: Record<string, TeamServerEntry>;
  skills?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: "stdio" | "http" | "sse";
  url?: string;
  description?: string;
}

export interface TeamAuditEntry {
  timestamp: string;
  actor: string;
  action: "add_server" | "remove_server" | "add_member" | "remove_member" | "sync" | "share";
  target: string;
  details?: string;
}
