/**
 * skill.ts
 * CLI command: `mcpman skill <install|list|remove|sync|export>`
 * Manages reusable skill bundles — rules + optional MCP servers packaged together.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { getClientTypes } from "../core/completion-generator.js";
import { installServer } from "../core/installer.js";
import {
  installSkill,
  listSkills,
  removeSkill,
  syncSkillsToClient,
} from "../core/skill-service.js";
import type { InstalledSkill, SkillRule, SkillSpec } from "../core/skill-types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Render a simple table of installed skills to stdout */
function printSkillTable(skills: InstalledSkill[]): void {
  const nameW = Math.max(4, ...skills.map((s) => s.spec.name.length));
  const verW = Math.max(7, ...skills.map((s) => s.spec.version.length));
  const descW = 40;

  const header = [
    pc.bold("NAME".padEnd(nameW)),
    pc.bold("VERSION".padEnd(verW)),
    pc.bold("RULES".padEnd(5)),
    pc.bold("DESCRIPTION".padEnd(descW)),
  ].join("  ");

  console.log(header);
  console.log(pc.dim("─".repeat(nameW + verW + 5 + descW + 6)));

  for (const sk of skills) {
    const desc = sk.spec.description ?? "";
    const row = [
      pc.cyan(sk.spec.name.padEnd(nameW)),
      sk.spec.version.padEnd(verW),
      String(sk.spec.rules.length).padEnd(5),
      pc.dim(desc.length > descW ? `${desc.slice(0, descW - 1)}…` : desc.padEnd(descW)),
    ].join("  ");
    console.log(row);
  }
}

// ── Sub-command: install ───────────────────────────────────────────────────

const installCommand = defineCommand({
  meta: { name: "install", description: "Install a skill from a JSON spec file or npm package" },
  args: {
    source: {
      type: "positional",
      description: "Path to mcpman-skill.json or npm package name",
      required: true,
    },
  },
  async run({ args }) {
    p.intro(pc.cyan("mcpman skill install"));

    let spec: SkillSpec;

    if (existsSync(args.source)) {
      // Load from local JSON file
      const spin = p.spinner();
      spin.start(`Reading spec from ${args.source}...`);
      try {
        const raw = readFileSync(args.source, "utf8");
        spec = JSON.parse(raw) as SkillSpec;
        spin.stop(`${pc.green("✓")} Loaded spec: ${pc.bold(spec.name)} v${spec.version}`);
      } catch (err) {
        spin.stop(`${pc.red("✗")} Failed to read spec`);
        console.error(pc.dim(String(err)));
        process.exit(1);
      }
    } else {
      // Treat as npm package name — load spec from installed package
      const spin = p.spinner();
      spin.start(`Loading skill package ${pc.bold(args.source)}...`);
      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        spec = req(`${args.source}/mcpman-skill.json`) as SkillSpec;
        spin.stop(`${pc.green("✓")} Loaded spec: ${pc.bold(spec.name)} v${spec.version}`);
      } catch (err) {
        spin.stop(`${pc.red("✗")} Could not load skill package "${args.source}"`);
        console.error(pc.dim(String(err)));
        process.exit(1);
      }
    }

    // Install the skill (rules + metadata)
    const installSpin = p.spinner();
    installSpin.start("Installing skill rules...");
    try {
      installSkill(spec);
      installSpin.stop(`${pc.green("✓")} Skill ${pc.bold(spec.name)} installed`);
    } catch (err) {
      installSpin.stop(`${pc.red("✗")} Failed to install skill`);
      console.error(pc.dim(String(err)));
      process.exit(1);
    }

    // Install bundled MCP servers if present
    if (spec.mcp_servers && spec.mcp_servers.length > 0) {
      p.log.info(`Installing ${spec.mcp_servers.length} bundled MCP server(s)...`);
      for (const server of spec.mcp_servers) {
        try {
          await installServer(server.name, { yes: true });
          p.log.step(`${pc.green("✓")} Server: ${pc.cyan(server.name)}`);
        } catch (err) {
          p.log.warn(`${pc.yellow("⚠")} Server ${server.name} failed: ${String(err)}`);
        }
      }
    }

    p.outro(
      pc.dim(`Skill "${spec.name}" ready. Run 'mcpman skill sync' to push rules to clients.`),
    );
  },
});

// ── Sub-command: list ──────────────────────────────────────────────────────

const listCommand = defineCommand({
  meta: { name: "list", description: "List installed skills" },
  run() {
    const skills = listSkills();

    if (skills.length === 0) {
      console.log(pc.dim("No skills installed. Use `mcpman skill install <path-or-package>`."));
      return;
    }

    console.log("");
    printSkillTable(skills);
    console.log("");
    console.log(pc.dim(`  ${skills.length} skill${skills.length !== 1 ? "s" : ""} installed`));
  },
});

// ── Sub-command: remove ────────────────────────────────────────────────────

const removeCommand = defineCommand({
  meta: { name: "remove", description: "Remove an installed skill" },
  args: {
    name: {
      type: "positional",
      description: "Skill name to remove",
      required: true,
    },
  },
  async run({ args }) {
    const confirmed = await p.confirm({
      message: `Remove skill ${pc.bold(args.name)}?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled.");
      return;
    }

    try {
      const removed = removeSkill(args.name);
      if (!removed) {
        console.log(pc.dim(`Skill "${args.name}" not found.`));
        return;
      }
      console.log(`${pc.green("✓")} Skill ${pc.bold(args.name)} removed.`);
    } catch (err) {
      console.error(
        `${pc.red("✗")} Failed to remove skill: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  },
});

// ── Sub-command: sync ──────────────────────────────────────────────────────

const syncCommand = defineCommand({
  meta: { name: "sync", description: "Sync all skill rules to installed clients" },
  args: {
    client: {
      type: "string",
      description: `Target client (${getClientTypes().join(", ")})`,
    },
  },
  run({ args }) {
    p.intro(pc.cyan("mcpman skill sync"));

    const targets = args.client ? [args.client] : getClientTypes();
    let totalRules = 0;
    let clientsUpdated = 0;

    for (const client of targets) {
      try {
        const written = syncSkillsToClient(client as Parameters<typeof syncSkillsToClient>[0]);
        if (written.length > 0) {
          totalRules += written.length;
          clientsUpdated++;
          p.log.step(
            `${pc.green("✓")} ${pc.cyan(client)}: ${written.length} file${written.length !== 1 ? "s" : ""} written`,
          );
        }
      } catch (err) {
        // Skip clients with no adapter — not an error
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("No format adapter")) {
          p.log.warn(`${pc.yellow("⚠")} ${client}: ${msg}`);
        }
      }
    }

    p.outro(
      pc.dim(
        `${totalRules} file${totalRules !== 1 ? "s" : ""} written across ${clientsUpdated} client${clientsUpdated !== 1 ? "s" : ""}.`,
      ),
    );
  },
});

// ── Sub-command: export ────────────────────────────────────────────────────

/** Rule file locations to scan when exporting current project as a skill spec */
const RULE_SCAN_LOCATIONS = [
  { path: "CLAUDE.md", name: "claude-instructions" },
  { path: ".github/copilot-instructions.md", name: "copilot-instructions" },
  { path: ".cursor/rules/rules.md", name: "cursor-rules" },
  { path: ".roo/rules/rules.md", name: "roo-rules" },
  { path: ".continue/rules/rules.md", name: "continue-rules" },
];

const exportCommand = defineCommand({
  meta: { name: "export", description: "Export current project rules as a skill spec" },
  args: {
    name: {
      type: "positional",
      description: "Name for the exported skill",
      required: true,
    },
    version: {
      type: "string",
      description: "Version string (default: 1.0.0)",
      default: "1.0.0",
    },
  },
  run({ args }) {
    p.intro(pc.cyan("mcpman skill export"));

    const cwd = process.cwd();
    const rules: SkillRule[] = [];

    for (const loc of RULE_SCAN_LOCATIONS) {
      const fullPath = `${cwd}/${loc.path}`;
      if (!existsSync(fullPath)) continue;
      try {
        const content = readFileSync(fullPath, "utf8");
        rules.push({ name: loc.name, content });
        p.log.step(`${pc.green("✓")} Found: ${pc.dim(loc.path)}`);
      } catch {
        // Skip unreadable files
      }
    }

    if (rules.length === 0) {
      console.log(pc.yellow("⚠ No rule files found in current directory."));
      p.outro(pc.dim("Nothing to export."));
      return;
    }

    const spec: SkillSpec = {
      name: args.name,
      version: args.version,
      description: `Exported from ${cwd}`,
      rules,
    };

    const outPath = `${cwd}/mcpman-skill.json`;
    try {
      writeFileSync(outPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
      console.log(`${pc.green("✓")} Written: ${pc.bold("mcpman-skill.json")}`);
    } catch (err) {
      console.error(`${pc.red("✗")} Failed to write spec: ${String(err)}`);
      process.exit(1);
    }

    p.outro(
      pc.dim(
        `Exported "${args.name}" v${args.version} with ${rules.length} rule${rules.length !== 1 ? "s" : ""}.`,
      ),
    );
  },
});

// ── Main command ───────────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "skill",
    description: "Manage reusable skill bundles (rules + MCP servers)",
  },
  subCommands: {
    install: installCommand,
    list: listCommand,
    remove: removeCommand,
    sync: syncCommand,
    export: exportCommand,
  },
});
