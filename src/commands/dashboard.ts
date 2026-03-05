/**
 * dashboard.ts
 * CLI command to start the mcpman embedded web dashboard.
 *
 * Usage:
 *   mcpman dashboard             # serves at http://localhost:24242
 *   mcpman dashboard --port 8080 # custom port
 */

import { intro, log, outro } from "@clack/prompts";
import { defineCommand } from "citty";
import { createDashboardServer } from "../core/dashboard-api.js";

const DEFAULT_PORT = 24242;

export default defineCommand({
  meta: {
    name: "dashboard",
    description: "Start the mcpman embedded web dashboard",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: `Port to listen on (default: ${DEFAULT_PORT})`,
      default: String(DEFAULT_PORT),
    },
  },
  async run({ args }) {
    const port = Number(args.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      log.error(`Invalid port: ${args.port}`);
      process.exit(1);
    }

    intro("mcpman dashboard");

    const server = createDashboardServer(port);

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        log.error(`Port ${port} is already in use. Try --port <number>.`);
      } else {
        log.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });

    log.success(`Dashboard running at http://localhost:${port}`);
    log.info("Press Ctrl+C to stop");

    // Keep alive until SIGINT
    await new Promise<void>((resolve) => {
      process.once("SIGINT", () => {
        server.close(() => resolve());
      });
    });

    outro("Dashboard stopped.");
  },
});
