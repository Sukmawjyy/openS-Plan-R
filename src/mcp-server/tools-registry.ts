/**
 * tools-registry.ts
 * MCP tool handlers for registry operations: install, remove, search.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readLockfile, removeEntry } from "../core/lockfile.js";
import { searchNpm, searchSmithery } from "../core/registry-search.js";
import { resolveFromNpm, resolveFromSmithery, resolveFromGitHub } from "../core/registry.js";
import { textResult, errorResult } from "./tool-helpers.js";

/** Whether write operations are allowed (set via --allow-write on serve command) */
let writeEnabled = false;

export function setWriteEnabled(enabled: boolean): void {
  writeEnabled = enabled;
}

// ── Install (read-only resolver) ─────────────────────────────────────────────

export async function handleInstall(args: Record<string, unknown>): Promise<CallToolResult> {
  const name = String(args.name ?? "");
  const url = args.url ? String(args.url) : undefined;

  if (!name) return errorResult("Error: 'name' argument is required");

  try {
    let meta: Awaited<ReturnType<typeof resolveFromNpm>>;

    if (url) {
      return textResult(
        `Remote server '${name}' noted at ${url}.\n` +
          `Use 'mcpman install ${name} --url ${url}' from the CLI to configure it for a client.`,
      );
    } else if (name.startsWith("https://github.com/")) {
      meta = await resolveFromGitHub(name);
    } else {
      try {
        meta = await resolveFromNpm(name);
      } catch {
        meta = await resolveFromSmithery(name);
      }
    }

    const summary = [
      `Resolved: ${meta.name}@${meta.version}`,
      `Runtime:  ${meta.runtime}`,
      `Command:  ${meta.command} ${meta.args.join(" ")}`,
      meta.description ? `Desc:     ${meta.description}` : null,
      "",
      `Note: Entry resolved but not written to lockfile via MCP tool.`,
      `Run 'mcpman install ${name}' from the CLI to fully install and configure for a client.`,
    ]
      .filter(Boolean)
      .join("\n");

    return textResult(summary);
  } catch (err) {
    return errorResult(`Error resolving '${name}': ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Remove ───────────────────────────────────────────────────────────────────

export async function handleRemove(args: Record<string, unknown>): Promise<CallToolResult> {
  const name = String(args.name ?? "");
  if (!name) return errorResult("Error: 'name' argument is required");

  if (!writeEnabled) {
    return errorResult(
      "Write operations are disabled. Start mcpman with 'mcpman serve --allow-write' to enable remove.",
    );
  }

  try {
    const data = readLockfile();
    if (!(name in data.servers)) {
      return errorResult(`Server '${name}' not found in lockfile.`);
    }
    removeEntry(name);
    return textResult(`Server '${name}' removed from lockfile.`);
  } catch (err) {
    return errorResult(`Error removing '${name}': ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function handleSearch(args: Record<string, unknown>): Promise<CallToolResult> {
  const query = String(args.query ?? "");
  const limit = Math.max(1, Math.min(100, typeof args.limit === "number" ? args.limit : 10));

  if (!query) return errorResult("Error: 'query' argument is required");

  try {
    const [npmResults, smitheryResults] = await Promise.all([
      searchNpm(query, limit),
      searchSmithery(query, limit),
    ]);

    const lines: string[] = [];

    if (smitheryResults.length > 0) {
      lines.push("Smithery Registry:");
      for (const r of smitheryResults.slice(0, limit)) {
        const verified = r.verified ? " [verified]" : "";
        lines.push(`  ${r.name}${verified} — ${r.description || "(no description)"}`);
      }
      lines.push("");
    }

    if (npmResults.length > 0) {
      lines.push("npm Registry:");
      for (const r of npmResults.slice(0, limit)) {
        const dl = r.downloads ? ` (${r.downloads.toLocaleString()}/week)` : "";
        lines.push(`  ${r.name}@${r.version}${dl} — ${r.description || "(no description)"}`);
      }
    }

    if (lines.length === 0) {
      return textResult(`No results found for '${query}'.`);
    }

    return textResult(`Search results for '${query}':\n\n${lines.join("\n")}`);
  } catch (err) {
    return errorResult(`Error searching: ${err instanceof Error ? err.message : String(err)}`);
  }
}
