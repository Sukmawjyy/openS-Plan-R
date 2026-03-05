/**
 * tools-query.ts
 * MCP tool handlers for queries: list, info, status.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readLockfile } from "../core/lockfile.js";
import { resolveFromNpm } from "../core/registry.js";
import { errorResult, textResult } from "./tool-helpers.js";

// ── List ─────────────────────────────────────────────────────────────────────

export async function handleList(args: Record<string, unknown>): Promise<CallToolResult> {
  const filterClient = args.client ? String(args.client) : undefined;

  try {
    const data = readLockfile();
    const entries = Object.entries(data.servers);

    const filtered = filterClient
      ? entries.filter(([, entry]) => entry.clients?.includes(filterClient as never))
      : entries;

    if (filtered.length === 0) {
      const msg = filterClient
        ? `No servers installed for client '${filterClient}'.`
        : "No MCP servers installed.";
      return textResult(msg);
    }

    const lines = filtered.map(([name, entry]) => {
      const clients = entry.clients?.join(", ") || "none";
      return `  ${name}@${entry.version}  [${entry.source}]  clients: ${clients}`;
    });

    return textResult(`Installed MCP servers (${filtered.length}):\n\n${lines.join("\n")}`);
  } catch (err) {
    return errorResult(
      `Error listing servers: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Info ─────────────────────────────────────────────────────────────────────

export async function handleInfo(args: Record<string, unknown>): Promise<CallToolResult> {
  const name = String(args.name ?? "");
  if (!name) return errorResult("Error: 'name' argument is required");

  try {
    const data = readLockfile();
    const entry = data.servers[name];

    if (!entry) {
      try {
        const meta = await resolveFromNpm(name);
        return textResult(
          [
            `${meta.name}@${meta.version} [not installed]`,
            `Runtime: ${meta.runtime}`,
            `Command: ${meta.command} ${meta.args.join(" ")}`,
            meta.description ? `Description: ${meta.description}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch {
        return errorResult(`Server '${name}' not found in lockfile or registries.`);
      }
    }

    const lines = [
      `${name}@${entry.version} [installed]`,
      `Source:    ${entry.source}`,
      `Runtime:   ${entry.runtime}`,
      `Command:   ${entry.command} ${entry.args.join(" ")}`,
      `Clients:   ${entry.clients?.join(", ") || "none"}`,
      `Installed: ${entry.installedAt}`,
      entry.transport ? `Transport: ${entry.transport}` : null,
      entry.url ? `URL:       ${entry.url}` : null,
    ].filter(Boolean);

    return textResult(lines.join("\n"));
  } catch (err) {
    return errorResult(
      `Error fetching info for '${name}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Status ───────────────────────────────────────────────────────────────────

export async function handleStatus(_args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const data = readLockfile();
    const { servers } = data;
    const total = Object.keys(servers).length;

    if (total === 0) {
      return textResult("No MCP servers installed. Run 'mcpman install <server>' to get started.");
    }

    const bySource: Record<string, number> = {};
    const byClient: Record<string, number> = {};

    for (const entry of Object.values(servers)) {
      bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;
      for (const client of entry.clients ?? []) {
        byClient[client] = (byClient[client] ?? 0) + 1;
      }
    }

    const sourceLines = Object.entries(bySource).map(([s, n]) => `  ${s}: ${n}`);
    const clientLines = Object.entries(byClient).map(([c, n]) => `  ${c}: ${n}`);

    const lines = [
      `Total installed: ${total}`,
      "",
      "By source:",
      ...sourceLines,
      "",
      "By client:",
      ...(clientLines.length > 0 ? clientLines : ["  (none)"]),
      "",
      "Server list:",
      ...Object.entries(servers).map(([n, e]) => `  ${n}@${e.version}`),
    ];

    return textResult(lines.join("\n"));
  } catch (err) {
    return errorResult(
      `Error fetching status: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
