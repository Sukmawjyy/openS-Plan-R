import * as p from "@clack/prompts";
import type { ClientHandler, ServerEntry, TransportType } from "../clients/types.js";
import { offerVaultSave, tryLoadVaultSecrets } from "./installer-vault-helpers.js";
import { type LockEntry, addEntry, findLockfile } from "./lockfile.js";
import { computeIntegrity } from "./registry.js";
import { buildRemoteEntry, resolveTransport, validateRemoteUrl } from "./remote-installer.js";
import { detectSource, parseEnvFlags, resolveServer } from "./server-resolver.js";

export interface InstallOptions {
  client?: string;
  env?: string | string[];
  yes?: boolean;
}

export interface RemoteInstallOptions {
  url: string;
  name: string;
  transport?: TransportType;
  headers?: Record<string, string>;
  clientFilter?: string;
  yes?: boolean;
}

// Dynamically import client detector (built by dev-2)
async function loadClients(): Promise<ClientHandler[]> {
  try {
    const mod = await import("../clients/client-detector.js");
    return mod.getInstalledClients();
  } catch {
    return [];
  }
}

export async function installServer(input: string, options: InstallOptions = {}): Promise<void> {
  p.intro("mcpman install");

  // 1. Resolve metadata
  const spinner = p.spinner();
  spinner.start("Resolving server...");

  let metadata: Awaited<ReturnType<typeof resolveServer>>;
  try {
    metadata = await resolveServer(input);
  } catch (err) {
    spinner.stop("Resolution failed");
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  spinner.stop(`Found: ${metadata.name}@${metadata.version}`);

  // 2. Detect installed clients
  const clients = await loadClients();
  if (clients.length === 0) {
    p.log.warn("No supported AI clients detected on this machine.");
    p.log.info(
      "Supported: Claude Desktop, Cursor, VS Code, Windsurf, Claude Code, Roo Code, Codex CLI, OpenCode, Continue, Zed",
    );
    process.exit(1);
  }

  // 3. Select target client(s)
  let selectedClients: ClientHandler[];
  if (options.client) {
    const found = clients.find(
      (c) =>
        c.type === options.client || c.displayName.toLowerCase() === options.client?.toLowerCase(),
    );
    if (!found) {
      p.log.error(`Client '${options.client}' not found or not installed.`);
      p.log.info(`Available: ${clients.map((c) => c.type).join(", ")}`);
      process.exit(1);
    }
    selectedClients = [found];
  } else if (options.yes || clients.length === 1) {
    selectedClients = clients;
  } else {
    const chosen = await p.multiselect({
      message: "Install to which client(s)?",
      options: clients.map((c) => ({ value: c.type, label: c.displayName })),
      required: true,
    });
    if (p.isCancel(chosen)) {
      p.outro("Cancelled.");
      process.exit(0);
    }
    selectedClients = clients.filter((c) => (chosen as unknown as string[]).includes(c.type));
  }

  // 4. Collect env vars — priority: --env flags > vault > prompt
  const providedEnv = parseEnvFlags(options.env);

  // Load vault secrets silently; vault fills gaps that --env didn't provide
  const vaultEnv = await tryLoadVaultSecrets(metadata.name);
  const collectedEnv: Record<string, string> = { ...vaultEnv, ...providedEnv };

  // Track vars entered interactively (not from vault or --env) for vault save offer
  const newlyEnteredVars: Record<string, string> = {};

  const requiredVars = metadata.envVars.filter((e) => e.required && !(e.name in collectedEnv));
  for (const envVar of requiredVars) {
    if (options.yes && envVar.default) {
      collectedEnv[envVar.name] = envVar.default;
      continue;
    }
    const val = await p.text({
      message: `${envVar.name}${envVar.description ? ` — ${envVar.description}` : ""}`,
      placeholder: envVar.default ?? "",
      validate: (v) => (envVar.required && !v ? "Required" : undefined),
    });
    if (p.isCancel(val)) {
      p.outro("Cancelled.");
      process.exit(0);
    }
    collectedEnv[envVar.name] = val as string;
    newlyEnteredVars[envVar.name] = val as string;
  }

  // 5. Build ServerEntry
  const entry: ServerEntry = {
    command: metadata.command,
    args: metadata.args,
    ...(Object.keys(collectedEnv).length > 0 ? { env: collectedEnv } : {}),
  };

  // 6. Write to each selected client config
  spinner.start("Writing config...");
  const clientTypes: string[] = [];
  for (const client of selectedClients) {
    try {
      await client.addServer(metadata.name, entry);
      clientTypes.push(client.type);
    } catch (err) {
      spinner.stop("Partial failure");
      p.log.warn(
        `Failed to write to ${client.displayName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  spinner.stop("Config written");

  // 7. Update lockfile
  const source = detectSource(input);
  const integrity = computeIntegrity(metadata.resolved);
  addEntry(metadata.name, {
    version: metadata.version,
    source: source.type as LockEntry["source"],
    resolved: metadata.resolved,
    integrity,
    runtime: metadata.runtime,
    command: metadata.command,
    args: metadata.args,
    envVars: metadata.envVars.map((e) => e.name),
    installedAt: new Date().toISOString(),
    clients: clientTypes as import("../clients/types.js").ClientType[],
  });

  const lockPath = findLockfile() ?? "mcpman.lock (global)";
  p.log.success(`Lockfile updated: ${lockPath}`);

  // 8. Offer to save newly entered vars to vault
  await offerVaultSave(metadata.name, newlyEnteredVars, options.yes ?? false);

  p.outro(`${metadata.name}@${metadata.version} installed to ${clientTypes.join(", ")}`);
}

/** Install a remote HTTP/SSE MCP server */
export async function installRemoteServer(options: RemoteInstallOptions): Promise<void> {
  p.intro("mcpman install (remote)");

  // 1. Validate URL
  const urlCheck = validateRemoteUrl(options.url);
  if (!urlCheck.valid) {
    p.log.error(urlCheck.error ?? "Invalid URL");
    process.exit(1);
  }

  const transport = resolveTransport(options.url, options.transport);
  p.log.info(`Transport: ${transport} → ${options.url}`);

  // 2. Detect installed clients
  const clients = await loadClients();
  if (clients.length === 0) {
    p.log.warn("No supported AI clients detected on this machine.");
    process.exit(1);
  }

  // 3. Select target client(s)
  let selectedClients: ClientHandler[];
  if (options.clientFilter) {
    const found = clients.find(
      (c) =>
        c.type === options.clientFilter ||
        c.displayName.toLowerCase() === options.clientFilter?.toLowerCase(),
    );
    if (!found) {
      p.log.error(`Client '${options.clientFilter}' not found or not installed.`);
      process.exit(1);
    }
    selectedClients = [found];
  } else if (options.yes || clients.length === 1) {
    selectedClients = clients;
  } else {
    const chosen = await p.multiselect({
      message: "Install to which client(s)?",
      options: clients.map((c) => ({ value: c.type, label: c.displayName })),
      required: true,
    });
    if (p.isCancel(chosen)) {
      p.outro("Cancelled.");
      process.exit(0);
    }
    selectedClients = clients.filter((c) => (chosen as unknown as string[]).includes(c.type));
  }

  // 4. Build remote ServerEntry
  const entry = buildRemoteEntry({
    url: options.url,
    name: options.name,
    transport: options.transport,
    headers: options.headers,
  });

  // 5. Write to each selected client config
  const spinner = p.spinner();
  spinner.start("Writing config...");
  const clientTypes: string[] = [];
  for (const client of selectedClients) {
    try {
      await client.addServer(options.name, entry);
      clientTypes.push(client.type);
    } catch (err) {
      spinner.stop("Partial failure");
      p.log.warn(
        `Failed to write to ${client.displayName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  spinner.stop("Config written");

  // 6. Update lockfile
  const integrity = computeIntegrity(options.url);
  addEntry(options.name, {
    version: "remote",
    source: "local",
    resolved: options.url,
    integrity,
    runtime: "node",
    command: "",
    args: [],
    envVars: [],
    installedAt: new Date().toISOString(),
    clients: clientTypes as import("../clients/types.js").ClientType[],
    transport,
    url: options.url,
  });

  const lockPath = findLockfile() ?? "mcpman.lock (global)";
  p.log.success(`Lockfile updated: ${lockPath}`);

  p.outro(`${options.name} (${transport}) installed to ${clientTypes.join(", ")}`);
}
