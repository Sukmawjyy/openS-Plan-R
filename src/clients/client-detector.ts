import { ClaudeCodeHandler } from "./claude-code.js";
import { ClaudeDesktopHandler } from "./claude-desktop.js";
import { CodexCliHandler } from "./codex-cli.js";
import { ContinueHandler } from "./continue-client.js";
import { CursorHandler } from "./cursor.js";
import { OpenCodeHandler } from "./opencode.js";
import { RooCodeHandler } from "./roo-code.js";
import type { ClientHandler, ClientType } from "./types.js";
import { VSCodeHandler } from "./vscode.js";
import { WindsurfHandler } from "./windsurf.js";
import { ZedHandler } from "./zed.js";

/** All supported client types */
export function getAllClientTypes(): ClientType[] {
  return [
    "claude-desktop",
    "cursor",
    "vscode",
    "windsurf",
    "claude-code",
    "roo-code",
    "codex-cli",
    "opencode",
    "continue",
    "zed",
  ];
}

/** Get handler instance for a specific client type */
export function getClient(type: ClientType): ClientHandler {
  switch (type) {
    case "claude-desktop":
      return new ClaudeDesktopHandler();
    case "cursor":
      return new CursorHandler();
    case "vscode":
      return new VSCodeHandler();
    case "windsurf":
      return new WindsurfHandler();
    case "claude-code":
      return new ClaudeCodeHandler();
    case "roo-code":
      return new RooCodeHandler();
    case "codex-cli":
      return new CodexCliHandler();
    case "opencode":
      return new OpenCodeHandler();
    case "continue":
      return new ContinueHandler();
    case "zed":
      return new ZedHandler();
  }
}

/** Returns handlers for all AI clients that appear to be installed on the system */
export async function getInstalledClients(): Promise<ClientHandler[]> {
  const all = getAllClientTypes().map(getClient);
  const results = await Promise.all(
    all.map(async (handler) => ({ handler, installed: await handler.isInstalled() })),
  );
  return results.filter((r) => r.installed).map((r) => r.handler);
}
