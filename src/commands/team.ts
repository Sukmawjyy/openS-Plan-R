/**
 * team.ts
 * CLI command: `mcpman team <init|add|remove|sync|share|audit|list>`
 * Manages shared MCP configurations for teams via .mcpman/team.json (git-tracked).
 */

import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
  addMember,
  getAuditLog,
  initTeam,
  readTeamConfig,
  removeMember,
  shareLocalToTeam,
  syncTeamToLocal,
} from "../core/team-service.js";
import type { TeamRole } from "../core/team-types.js";

// ── Sub-command: init ─────────────────────────────────────────────────────────

const initCommand = defineCommand({
  meta: { name: "init", description: "Initialize a team config in current project" },
  args: {
    name: { type: "positional", description: "Team name", required: true },
  },
  run({ args }) {
    p.intro(pc.cyan("mcpman team init"));
    try {
      const config = initTeam(args.name);
      p.log.success(`Team ${pc.bold(config.name)} created in ${pc.dim(".mcpman/team.json")}`);
      p.outro(pc.dim("Commit .mcpman/team.json to share with your team."));
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

// ── Sub-command: add ──────────────────────────────────────────────────────────

const addCommand = defineCommand({
  meta: { name: "add", description: "Add a team member" },
  args: {
    member: { type: "positional", description: "Member username", required: true },
    role: { type: "string", description: "Role: admin | member | viewer", default: "member" },
  },
  run({ args }) {
    const validRoles: TeamRole[] = ["admin", "member", "viewer"];
    if (!validRoles.includes(args.role as TeamRole)) {
      p.log.error(`Invalid role "${args.role}". Must be: ${validRoles.join(", ")}`);
      process.exit(1);
    }
    try {
      addMember(args.member, args.role as TeamRole);
      p.log.success(`Added ${pc.bold(args.member)} as ${pc.cyan(args.role)}`);
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

// ── Sub-command: remove ───────────────────────────────────────────────────────

const removeCommand = defineCommand({
  meta: { name: "remove", description: "Remove a team member" },
  args: {
    member: { type: "positional", description: "Member username to remove", required: true },
  },
  run({ args }) {
    try {
      removeMember(args.member);
      p.log.success(`Removed ${pc.bold(args.member)} from team`);
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

// ── Sub-command: sync ─────────────────────────────────────────────────────────

const syncCommand = defineCommand({
  meta: { name: "sync", description: "Pull team servers into local lockfile" },
  run() {
    p.intro(pc.cyan("mcpman team sync"));
    try {
      const result = syncTeamToLocal();
      if (result.added.length)
        p.log.step(`Added: ${result.added.map((s) => pc.green(s)).join(", ")}`);
      if (result.updated.length)
        p.log.step(`Updated: ${result.updated.map((s) => pc.cyan(s)).join(", ")}`);
      if (!result.added.length && !result.updated.length)
        p.log.info("Local lockfile already up to date.");
      p.outro(pc.dim(`${result.added.length + result.updated.length} server(s) synced.`));
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

// ── Sub-command: share ────────────────────────────────────────────────────────

const shareCommand = defineCommand({
  meta: { name: "share", description: "Push local servers to team config" },
  args: {
    servers: {
      type: "positional",
      description: "Server name(s) to share (comma-separated)",
      required: false,
    },
  },
  run({ args }) {
    p.intro(pc.cyan("mcpman team share"));
    const names = args.servers
      ? args.servers
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    if (!names.length) {
      p.log.error(
        "Provide server name(s) to share, e.g.: mcpman team share my-server,other-server",
      );
      process.exit(1);
    }
    try {
      shareLocalToTeam(names);
      p.log.success(`Shared: ${names.map((n: string) => pc.cyan(n)).join(", ")}`);
      p.outro(pc.dim("Commit .mcpman/team.json to share with your team."));
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

// ── Sub-command: audit ────────────────────────────────────────────────────────

const auditCommand = defineCommand({
  meta: { name: "audit", description: "Show team audit log" },
  args: {
    limit: {
      type: "string",
      description: "Number of entries to show (default: 20)",
      default: "20",
    },
  },
  run({ args }) {
    const log = getAuditLog();
    if (!log.length) {
      console.log(pc.dim("No audit entries found."));
      return;
    }
    const n = Math.max(1, Number.parseInt(args.limit, 10) || 20);
    const entries = log.slice(-n).reverse();
    console.log("");
    for (const entry of entries) {
      const ts = pc.dim(new Date(entry.timestamp).toLocaleString());
      console.log(
        `  ${ts}  ${pc.cyan(entry.actor)}  ${pc.bold(entry.action)}  ${pc.yellow(entry.target)}${entry.details ? pc.dim(` (${entry.details})`) : ""}`,
      );
    }
    console.log("");
    console.log(pc.dim(`  Showing ${entries.length} of ${log.length} entries`));
  },
});

// ── Sub-command: list ─────────────────────────────────────────────────────────

const listCommand = defineCommand({
  meta: { name: "list", description: "Show team info, members, and servers" },
  run() {
    const config = readTeamConfig();
    if (!config) {
      console.log(pc.yellow("No team config found. Run `mcpman team init <name>` first."));
      return;
    }

    console.log("");
    console.log(`  ${pc.bold("Team:")} ${pc.cyan(config.name)}`);
    console.log(`  ${pc.dim("Created:")} ${new Date(config.createdAt).toLocaleDateString()}`);
    console.log(`  ${pc.dim("Updated:")} ${new Date(config.updatedAt).toLocaleDateString()}`);
    console.log("");

    if (config.members.length) {
      console.log(`  ${pc.bold("Members")} (${config.members.length})`);
      for (const m of config.members) {
        const roleColor = m.role === "admin" ? pc.red : m.role === "member" ? pc.green : pc.dim;
        console.log(`    ${pc.cyan(m.name.padEnd(20))} ${roleColor(m.role)}`);
      }
    }

    const serverNames = Object.keys(config.servers);
    if (serverNames.length) {
      console.log("");
      console.log(`  ${pc.bold("Servers")} (${serverNames.length})`);
      for (const [name, entry] of Object.entries(config.servers)) {
        const detail = entry.url ?? entry.command ?? "";
        console.log(`    ${pc.cyan(name.padEnd(20))} ${pc.dim(detail)}`);
      }
    }

    console.log("");
  },
});

// ── Main command ──────────────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "team",
    description: "Manage shared MCP configurations for teams (.mcpman/team.json)",
  },
  subCommands: {
    init: initCommand,
    add: addCommand,
    remove: removeCommand,
    sync: syncCommand,
    share: shareCommand,
    audit: auditCommand,
    list: listCommand,
  },
});
