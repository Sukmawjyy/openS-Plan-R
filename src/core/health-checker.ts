import type { ServerEntry } from "../clients/types.js";
import {
  type CheckResult,
  checkEnvVars,
  checkMcpHandshake,
  checkProcessSpawn,
  checkRuntime,
} from "./diagnostics.js";
import { checkRemoteEndpoint, checkRemoteMcpHandshake } from "./remote-health-checker.js";

export type HealthStatus = "healthy" | "unhealthy" | "unknown";

export interface HealthResult {
  serverName: string;
  status: HealthStatus;
  checks: CheckResult[];
}

/** Helper: check if a ServerEntry is a remote (HTTP/SSE) server */
function isRemote(config: ServerEntry): boolean {
  return config.type === "http" || config.type === "sse" || !!config.url;
}

/**
 * Run all health checks for a server and return detailed results.
 * Routes to remote checks for HTTP/SSE servers, stdio checks otherwise.
 */
export async function checkServerHealth(name: string, config: ServerEntry): Promise<HealthResult> {
  if (isRemote(config)) {
    return checkRemoteServerHealth(name, config);
  }
  const checks: CheckResult[] = [];

  const cmd = config.command ?? "";

  // 1. Runtime check
  const runtimeCheck = await checkRuntime(cmd);
  checks.push(runtimeCheck);

  // 2. Process spawn check (skip if runtime missing)
  if (!runtimeCheck.passed) {
    checks.push({
      name: "Process",
      passed: false,
      skipped: true,
      message: "skipped (runtime missing)",
    });
    checks.push({
      name: "MCP handshake",
      passed: false,
      skipped: true,
      message: "skipped (runtime missing)",
    });
  } else {
    const spawnCheck = await checkProcessSpawn(cmd, config.args ?? [], config.env ?? {});
    checks.push(spawnCheck);

    // 3. MCP handshake (skip if process can't spawn)
    if (!spawnCheck.passed) {
      checks.push({
        name: "MCP handshake",
        passed: false,
        skipped: true,
        message: "skipped (process failed)",
      });
    } else {
      const handshakeCheck = await checkMcpHandshake(cmd, config.args ?? [], config.env ?? {});
      checks.push(handshakeCheck);
    }
  }

  // 4. Env vars check (always runs)
  checks.push(checkEnvVars(config.env));

  // Determine overall status
  const failed = checks.filter((c) => !c.skipped && !c.passed);
  const status: HealthStatus = failed.length === 0 ? "healthy" : "unhealthy";

  return { serverName: name, status, checks };
}

/** Health checks for remote (HTTP/SSE) servers */
async function checkRemoteServerHealth(name: string, config: ServerEntry): Promise<HealthResult> {
  const checks: CheckResult[] = [];
  const url = config.url ?? "";

  // 1. Endpoint reachability
  const endpointCheck = await checkRemoteEndpoint(url);
  checks.push(endpointCheck);

  // 2. MCP handshake over HTTP (skip if endpoint unreachable)
  if (!endpointCheck.passed) {
    checks.push({
      name: "MCP handshake (HTTP)",
      passed: false,
      skipped: true,
      message: "skipped (endpoint unreachable)",
    });
  } else {
    const handshakeCheck = await checkRemoteMcpHandshake(url, config.headers ?? {});
    checks.push(handshakeCheck);
  }

  const failed = checks.filter((c) => !c.skipped && !c.passed);
  const status: HealthStatus = failed.length === 0 ? "healthy" : "unhealthy";

  return { serverName: name, status, checks };
}

/**
 * Lightweight health probe for use in `mcpman list`.
 * Returns HealthStatus without detailed check breakdown.
 */
export async function quickHealthProbe(
  config: ServerEntry,
  timeoutMs = 3000,
): Promise<HealthStatus> {
  try {
    // Remote servers: check endpoint + handshake
    if (isRemote(config)) {
      const url = config.url ?? "";
      const endpoint = await checkRemoteEndpoint(url, timeoutMs);
      if (!endpoint.passed) return "unhealthy";
      const handshake = await checkRemoteMcpHandshake(url, config.headers ?? {}, timeoutMs);
      return handshake.passed ? "healthy" : "unhealthy";
    }

    // Stdio servers: spawn + handshake
    const runtimeCheck = await checkRuntime(config.command ?? "");
    if (!runtimeCheck.passed) return "unhealthy";

    const handshake = await checkMcpHandshake(
      config.command ?? "",
      config.args ?? [],
      config.env ?? {},
      timeoutMs,
    );
    return handshake.passed ? "healthy" : "unhealthy";
  } catch {
    return "unknown";
  }
}
