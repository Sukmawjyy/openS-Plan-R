/**
 * mcpman-registry-client.ts
 * HTTP client for the mcpman registry API at https://registry.mcpman.dev/api.
 * All functions return gracefully on network errors (null / empty arrays).
 */

import type { ServerMetadata } from "./registry.js";

export const MCPMAN_REGISTRY_BASE = "https://registry.mcpman.dev/api";
const FETCH_TIMEOUT_MS = 10_000;

// ── Public types ──────────────────────────────────────────────────────────────

export interface McpmanPackage {
  name: string;
  description: string;
  version: string;
  author: string;
  type: "server" | "skill" | "template";
  downloads: number;
  trustScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface McpmanSearchResult {
  name: string;
  description: string;
  version: string;
  type: "server" | "skill" | "template";
  downloads: number;
  trustScore: number;
  author: string;
}

export interface PublishOptions {
  name: string;
  version: string;
  description: string;
  type: "server" | "skill" | "template";
  runtime: "node" | "python" | "docker";
  command: string;
  args: string[];
  tarballPath: string;
  checksum: string;
  token: string;
}

export interface PublishResult {
  name: string;
  version: string;
  url: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${MCPMAN_REGISTRY_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Exported functions ────────────────────────────────────────────────────────

/** Search mcpman registry for packages matching the query. Returns [] on failure. */
export async function searchMcpmanRegistry(
  query: string,
  limit = 20,
): Promise<McpmanSearchResult[]> {
  const cap = Math.min(limit, 100);
  const qs = `q=${encodeURIComponent(query)}&limit=${cap}`;
  const data = await apiFetch<{ results?: McpmanSearchResult[] }>(`/search?${qs}`);
  if (!data || !Array.isArray(data.results)) return [];
  return data.results.filter((r) => typeof r.name === "string" && r.name !== "");
}

/** Fetch full package metadata by name. Returns null when not found. */
export async function getMcpmanPackage(name: string): Promise<McpmanPackage | null> {
  return apiFetch<McpmanPackage>(`/packages/${encodeURIComponent(name)}`);
}

/** Publish a package to the mcpman registry. Throws on failure. */
export async function publishToMcpmanRegistry(options: PublishOptions): Promise<PublishResult> {
  const { token, tarballPath: _tarball, checksum, ...meta } = options;
  const body: Record<string, unknown> = { ...meta, checksum };

  const res = await fetch(`${MCPMAN_REGISTRY_BASE}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`Registry publish failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as PublishResult;
}

/** Resolve package metadata from mcpman registry for installer use. */
export async function resolveFromMcpman(name: string): Promise<ServerMetadata> {
  const pkg = await getMcpmanPackage(name);
  if (!pkg) {
    throw new Error(`Package '${name}' not found on mcpman registry`);
  }

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    runtime: "node",
    command: "npx",
    args: ["-y", `${pkg.name}@${pkg.version}`],
    envVars: [],
    resolved: `mcpman:${pkg.name}`,
  };
}
