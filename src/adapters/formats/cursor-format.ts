/**
 * cursor-format.ts
 * Format adapter for Cursor — generates .cursor/rules/*.mdc files.
 * Each rule becomes its own .mdc file with YAML frontmatter for
 * description, globs, and alwaysApply metadata.
 */

import type { SkillRule } from "../../core/skill-types.js";

export interface FormatOutput {
  filename: string;
  content: string;
}

/**
 * Builds YAML frontmatter for a Cursor .mdc rule file.
 * Only includes fields that have meaningful values.
 */
function buildFrontmatter(rule: SkillRule): string {
  const lines: string[] = ["---"];

  if (rule.description) {
    lines.push(`description: ${rule.description}`);
  }
  if (rule.globs && rule.globs.length > 0) {
    lines.push(`globs: ${rule.globs.join(", ")}`);
  }
  if (rule.alwaysApply !== undefined) {
    lines.push(`alwaysApply: ${rule.alwaysApply}`);
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Formats skill rules into .cursor/rules/*.mdc files.
 * One file per rule, each with YAML frontmatter + markdown content.
 */
export function formatRules(rules: SkillRule[]): FormatOutput[] {
  return rules.map((rule) => {
    const frontmatter = buildFrontmatter(rule);
    const content = [frontmatter, "", rule.content.trim(), ""].join("\n");
    return {
      filename: `.cursor/rules/${rule.name}.mdc`,
      content,
    };
  });
}
