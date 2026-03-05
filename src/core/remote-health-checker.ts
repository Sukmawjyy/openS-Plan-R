/**
 * remote-health-checker.ts
 * Health check for HTTP/SSE MCP servers via HTTP requests.
 */

import type { CheckResult } from "./diagnostics.js";

const DEFAULT_TIMEOUT_MS = 5000;

/** Check if a remote URL is reachable via HTTP GET */
export async function checkRemoteEndpoint(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json, text/event-stream" },
    });
    clearTimeout(timer);

    if (res.ok || res.status === 405) {
      // 405 is acceptable — endpoint exists but may only accept POST
      return { name: "Remote endpoint", passed: true, message: `HTTP ${res.status}` };
    }
    return {
      name: "Remote endpoint",
      passed: false,
      message: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "Remote endpoint", passed: false, message: `Unreachable: ${msg}` };
  }
}

/** Send JSON-RPC initialize request over HTTP POST */
export async function checkRemoteMcpHandshake(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcpman-test", version: "1.0.0" },
      },
    });

    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        name: "MCP handshake (HTTP)",
        passed: false,
        message: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.jsonrpc === "2.0" && data.result) {
      return { name: "MCP handshake (HTTP)", passed: true, message: "initialize OK" };
    }
    return {
      name: "MCP handshake (HTTP)",
      passed: false,
      message: data.error ? `RPC error: ${JSON.stringify(data.error)}` : "Unexpected response",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "MCP handshake (HTTP)", passed: false, message: `Failed: ${msg}` };
  }
}
