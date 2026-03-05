/**
 * roo-code-format.ts
 * Format adapter for Roo Code — generates .roo/rules/*.md files.
 * Each rule becomes its own plain Markdown file in the .roo/rules/ directory.
 */

import type { SkillRule } from "../../core/skill-types.js";

export interface FormatOutput {
  filename: string;
  content: string;
}

/**
 * Formats skill rules into .roo/rules/*.md files.
 * One plain Markdown file per rule — no frontmatter.
 */
export function formatRules(rules: SkillRule[]): FormatOutput[] {
  return rules.map((rule) => {
    const header = rule.description
      ? `# ${rule.name}\n\n${rule.description}\n\n`
      : `# ${rule.name}\n\n`;
    const content = [header, rule.content.trim(), ""].join("");
    return {
      filename: `.roo/rules/${rule.name}.md`,
      content,
    };
  });
}
