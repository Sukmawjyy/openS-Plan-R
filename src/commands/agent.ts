/**
 * agent.ts
 * CLI command: `mcpman agent <sync|list|export>`
 * Manages agent/mode definitions — syncs agent configs across supported tools.
 */

import { writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { clientSupportsAgents } from "../adapters/agent-format-registry.js";
import type { ClientType } from "../clients/types.js";
import { exportAgents, listAllInstalledAgents, syncAgentsToClient } from "../core/agent-service.js";
import { getClientTypes } from "../core/completion-generator.js";

// ── Sub-command: sync ──────────────────────────────────────────────────────

const syncCommand = defineCommand({
  meta: { name: "sync", description: "Sync agent configs to supported clients" },
  args: {
    client: {
      type: "string",
      description: `Target client (${getClientTypes().join(", ")})`,
    },
  },
  run({ args }) {
    p.intro(pc.cyan("mcpman agent sync"));

    const agents = listAllInstalledAgents();

    if (agents.length === 0) {
      console.log(pc.dim("No agents found in installed skills."));
      p.outro(pc.dim("Install a skill with agents to use this command."));
      return;
    }

    const allClients = getClientTypes() as ClientType[];
    const targets = args.client
      ? [args.client as ClientType]
      : allClients.filter(clientSupportsAgents);

    let totalFiles = 0;
    let clientsUpdated = 0;
    const cwd = process.cwd();

    for (const client of targets) {
      try {
        const written = syncAgentsToClient(client, agents, cwd);
        if (written.length > 0) {
          totalFiles += written.length;
          clientsUpdated++;
          p.log.step(
            `${pc.green("✓")} ${pc.cyan(client)}: ${written.length} file${written.length !== 1 ? "s" : ""} written`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("No agent format adapter")) {
          p.log.warn(`${pc.yellow("⚠")} ${client}: ${msg}`);
        }
      }
    }

    p.outro(
      pc.dim(
        `${totalFiles} file${totalFiles !== 1 ? "s" : ""} written across ${clientsUpdated} client${clientsUpdated !== 1 ? "s" : ""}.`,
      ),
    );
  },
});

// ── Sub-command: list ──────────────────────────────────────────────────────

const listCommand = defineCommand({
  meta: { name: "list", description: "List agents from installed skills" },
  run() {
    const agents = listAllInstalledAgents();

    if (agents.length === 0) {
      console.log(pc.dim("No agents found. Install a skill with agents defined."));
      return;
    }

    const nameW = Math.max(4, ...agents.map((a) => a.name.length));
    const modelW = 10;
    const descW = 40;

    const header = [
      pc.bold("NAME".padEnd(nameW)),
      pc.bold("MODEL".padEnd(modelW)),
      pc.bold("DESCRIPTION".padEnd(descW)),
    ].join("  ");

    console.log("");
    console.log(header);
    console.log(pc.dim("─".repeat(nameW + modelW + descW + 4)));

    for (const agent of agents) {
      const desc = agent.description ?? "";
      const model = agent.model ?? "—";
      const row = [
        pc.cyan(agent.name.padEnd(nameW)),
        model.padEnd(modelW),
        pc.dim(desc.length > descW ? `${desc.slice(0, descW - 1)}…` : desc.padEnd(descW)),
      ].join("  ");
      console.log(row);
    }

    console.log("");
    console.log(pc.dim(`  ${agents.length} agent${agents.length !== 1 ? "s" : ""} available`));
  },
});

// ── Sub-command: export ────────────────────────────────────────────────────

const exportCommand = defineCommand({
  meta: {
    name: "export",
    description: "Export existing agent configs as universal AgentSpec JSON",
  },
  run() {
    p.intro(pc.cyan("mcpman agent export"));

    const cwd = process.cwd();
    const agents = exportAgents(cwd);

    if (agents.length === 0) {
      console.log(pc.yellow("⚠ No agent config files found in current directory."));
      p.outro(pc.dim("Nothing to export."));
      return;
    }

    for (const agent of agents) {
      p.log.step(`${pc.green("✓")} Found: ${pc.dim(agent.name)}`);
    }

    const outPath = `${cwd}/mcpman-agents.json`;
    try {
      writeFileSync(outPath, `${JSON.stringify({ agents }, null, 2)}\n`, "utf8");
      console.log(`${pc.green("✓")} Written: ${pc.bold("mcpman-agents.json")}`);
    } catch (err) {
      console.error(`${pc.red("✗")} Failed to write: ${String(err)}`);
      process.exit(1);
    }

    p.outro(pc.dim(`Exported ${agents.length} agent${agents.length !== 1 ? "s" : ""}.`));
  },
});

// ── Main command ───────────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "agent",
    description: "Manage agent/mode definitions — sync across supported clients",
  },
  subCommands: {
    sync: syncCommand,
    list: listCommand,
    export: exportCommand,
  },
});
