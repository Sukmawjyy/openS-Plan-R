/**
 * publish.ts
 * CLI command: mcpman publish
 * Publishes the current directory as a package to the mcpman registry.
 */

import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { publishPackage, readPackageManifest, validateManifest } from "../core/publish-service.js";

export default defineCommand({
  meta: {
    name: "publish",
    description: "Publish current package to the mcpman registry",
  },
  args: {
    token: {
      type: "string",
      description: "Auth token for the mcpman registry",
    },
    "dry-run": {
      type: "boolean",
      description: "Validate manifest without publishing",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("mcpman publish");

    // 1. Read manifest
    let manifest: ReturnType<typeof readPackageManifest>;
    try {
      manifest = readPackageManifest();
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // 2. Validate
    const { valid, errors } = validateManifest(manifest);
    if (!valid) {
      p.log.error("Manifest validation failed:");
      for (const e of errors) {
        p.log.warn(`  - ${e}`);
      }
      process.exit(1);
    }

    p.log.info(`Package: ${manifest.name}@${manifest.version} (${manifest.type})`);

    // 3. Dry-run exits here
    if (args["dry-run"]) {
      p.outro("Dry run complete — manifest is valid.");
      return;
    }

    // 4. Resolve auth token
    const token =
      args.token ??
      process.env.MCPMAN_TOKEN ??
      (await p.text({
        message: "mcpman registry token:",
        validate: (v) => (v ? undefined : "Token is required"),
      }));

    if (p.isCancel(token)) {
      p.outro("Cancelled.");
      process.exit(0);
    }

    // 5. Publish
    const spinner = p.spinner();
    spinner.start("Publishing...");

    try {
      const result = await publishPackage(manifest, token as string);
      spinner.stop("Published");
      p.log.success(`${result.name}@${result.version} → ${result.url}`);
      p.outro("Done.");
    } catch (err) {
      spinner.stop("Publish failed");
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});
