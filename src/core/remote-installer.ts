/**
 * remote-installer.ts
 * Registers HTTP/SSE remote MCP servers.
 */

import type { ServerEntry, TransportType } from "../clients/types.js";

export interface RemoteInstallOptions {
  url: string;
  name: string;
  transport?: TransportType;
  headers?: Record<string, string>;
}

/** Validate URL and determine transport type */
export function resolveTransport(url: string, explicit?: TransportType): TransportType {
  if (explicit && explicit !== "stdio") return explicit;
  // SSE endpoints often end with /sse or /events
  if (/\/(sse|events)\/?$/i.test(url)) return "sse";
  return "http";
}

/** Validate remote URL format */
export function validateRemoteUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `Unsupported protocol: ${parsed.protocol}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/** Build a ServerEntry for a remote MCP server */
export function buildRemoteEntry(options: RemoteInstallOptions): ServerEntry {
  const transport = resolveTransport(options.url, options.transport);
  return {
    type: transport,
    url: options.url,
    ...(options.headers && Object.keys(options.headers).length > 0
      ? { headers: options.headers }
      : {}),
  };
}
