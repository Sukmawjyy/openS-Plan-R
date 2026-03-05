/**
 * agent-format-adapters.test.ts
 * Tests for all three agent format adapters:
 *   claude-code-agent-format, roo-code-agent-format, codex-agent-format.
 * Each adapter's formatAgents() function is tested for output structure and content.
 */

import { describe, expect, it } from "vitest";
import { formatAgents as claudeCodeFormatAgents } from "../../src/adapters/formats/claude-code-agent-format.js";
import { formatAgents as rooCodeFormatAgents } from "../../src/adapters/formats/roo-code-agent-format.js";
import { formatAgents as codexFormatAgents } from "../../src/adapters/formats/codex-agent-format.js";
import type { AgentSpec } from "../../src/core/skill-types.js";

// ── Shared fixtures ────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    name: "my-agent",
    role: "You are a helpful assistant.",
    ...overrides,
  };
}

// ── claude-code-agent-format ───────────────────────────────────────────────

describe("claude-code-agent-format — formatAgents()", () => {
  it("returns empty array for empty agents list", () => {
    expect(claudeCodeFormatAgents([])).toEqual([]);
  });

  it("returns one file output per agent", () => {
    const agents = [makeAgent({ name: "agent-a" }), makeAgent({ name: "agent-b" })];
    const outputs = claudeCodeFormatAgents(agents);
    expect(outputs).toHaveLength(2);
  });

  it("filename follows .claude/agents/{name}.md pattern", () => {
    const [output] = claudeCodeFormatAgents([makeAgent({ name: "my-agent" })]);
    expect(output.filename).toBe(".claude/agents/my-agent.md");
  });

  it("each agent gets its own separate file", () => {
    const agents = [makeAgent({ name: "reviewer" }), makeAgent({ name: "tester" })];
    const outputs = claudeCodeFormatAgents(agents);
    expect(outputs[0].filename).toBe(".claude/agents/reviewer.md");
    expect(outputs[1].filename).toBe(".claude/agents/tester.md");
  });

  it("content starts with YAML frontmatter opening ---", () => {
    const [output] = claudeCodeFormatAgents([makeAgent()]);
    expect(output.content).toMatch(/^---/);
  });

  it("content includes closing --- to end YAML frontmatter", () => {
    const [output] = claudeCodeFormatAgents([makeAgent()]);
    const lines = output.content.split("\n");
    const closingIdx = lines.indexOf("---", 1);
    expect(closingIdx).toBeGreaterThan(0);
  });

  it("frontmatter contains name field", () => {
    const [output] = claudeCodeFormatAgents([makeAgent({ name: "code-reviewer" })]);
    expect(output.content).toContain("name: code-reviewer");
  });

  it("content includes agent role after frontmatter", () => {
    const [output] = claudeCodeFormatAgents([makeAgent({ role: "Review code carefully." })]);
    expect(output.content).toContain("Review code carefully.");
  });

  it("includes description in frontmatter when agent has description", () => {
    const agent = makeAgent({ description: "A diligent code reviewer" });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("description: A diligent code reviewer");
  });

  it("does not include description line when agent has no description", () => {
    const agent = makeAgent({ description: undefined });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).not.toContain("description:");
  });

  // ── Model mapping tests ─────────────────────────────────────────────────

  it("maps model tier 'fast' to claude-haiku-4-5", () => {
    const agent = makeAgent({ model: "fast" });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("model: claude-haiku-4-5");
  });

  it("maps model tier 'balanced' to claude-sonnet-4-5", () => {
    const agent = makeAgent({ model: "balanced" });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("model: claude-sonnet-4-5");
  });

  it("maps model tier 'powerful' to claude-opus-4-5", () => {
    const agent = makeAgent({ model: "powerful" });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("model: claude-opus-4-5");
  });

  it("does not include model line when model is not specified", () => {
    const agent = makeAgent({ model: undefined });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).not.toContain("model:");
  });

  // ── Tools list tests ────────────────────────────────────────────────────

  it("includes tools in frontmatter as bracket list when tools provided", () => {
    const agent = makeAgent({ tools: ["Read", "Grep", "Bash"] });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("tools: [Read, Grep, Bash]");
  });

  it("does not include tools line when tools is undefined", () => {
    const agent = makeAgent({ tools: undefined });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).not.toContain("tools:");
  });

  it("does not include tools line when tools is empty array", () => {
    const agent = makeAgent({ tools: [] });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).not.toContain("tools:");
  });

  it("includes denied_tools in frontmatter when deniedTools provided", () => {
    const agent = makeAgent({ deniedTools: ["Bash", "Write"] });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("denied_tools: [Bash, Write]");
  });

  it("does not include denied_tools line when deniedTools is undefined", () => {
    const agent = makeAgent({ deniedTools: undefined });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).not.toContain("denied_tools:");
  });

  it("includes additional instructions in body after role when present", () => {
    const agent = makeAgent({ instructions: "Follow PEP8 guidelines." });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("Follow PEP8 guidelines.");
  });

  it("trims whitespace from role content", () => {
    const agent = makeAgent({ role: "  Trimmed role.  " });
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("Trimmed role.");
    expect(output.content).not.toContain("  Trimmed role.  ");
  });

  it("produces a complete frontmatter block with all optional fields", () => {
    const agent: AgentSpec = {
      name: "full-agent",
      description: "Does everything",
      role: "Full system prompt.",
      model: "balanced",
      tools: ["Read", "Edit"],
      deniedTools: ["Bash"],
    };
    const [output] = claudeCodeFormatAgents([agent]);
    expect(output.content).toContain("name: full-agent");
    expect(output.content).toContain("description: Does everything");
    expect(output.content).toContain("model: claude-sonnet-4-5");
    expect(output.content).toContain("tools: [Read, Edit]");
    expect(output.content).toContain("denied_tools: [Bash]");
    expect(output.content).toContain("Full system prompt.");
  });
});

// ── roo-code-agent-format ──────────────────────────────────────────────────

describe("roo-code-agent-format — formatAgents()", () => {
  it("returns empty array for empty agents list", () => {
    expect(rooCodeFormatAgents([])).toEqual([]);
  });

  it("returns exactly one file output for any non-empty agents list", () => {
    const agents = [makeAgent({ name: "agent-a" }), makeAgent({ name: "agent-b" })];
    const outputs = rooCodeFormatAgents(agents);
    expect(outputs).toHaveLength(1);
  });

  it("output filename is .roomodes", () => {
    const [output] = rooCodeFormatAgents([makeAgent()]);
    expect(output.filename).toBe(".roomodes");
  });

  it("content is valid JSON", () => {
    const [output] = rooCodeFormatAgents([makeAgent()]);
    expect(() => JSON.parse(output.content)).not.toThrow();
  });

  it("JSON has a customModes array at the root", () => {
    const [output] = rooCodeFormatAgents([makeAgent()]);
    const parsed = JSON.parse(output.content);
    expect(Array.isArray(parsed.customModes)).toBe(true);
  });

  it("customModes contains one entry per agent", () => {
    const agents = [makeAgent({ name: "alpha" }), makeAgent({ name: "beta" })];
    const [output] = rooCodeFormatAgents(agents);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes).toHaveLength(2);
  });

  it("each custom mode has slug equal to agent name", () => {
    const [output] = rooCodeFormatAgents([makeAgent({ name: "code-reviewer" })]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].slug).toBe("code-reviewer");
  });

  it("each custom mode has name equal to agent name", () => {
    const [output] = rooCodeFormatAgents([makeAgent({ name: "my-agent" })]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].name).toBe("my-agent");
  });

  it("each custom mode has roleDefinition equal to agent role", () => {
    const [output] = rooCodeFormatAgents([makeAgent({ role: "Carefully review all changes." })]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].roleDefinition).toBe("Carefully review all changes.");
  });

  it("includes description in custom mode when agent has description", () => {
    const agent = makeAgent({ description: "A meticulous reviewer" });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].description).toBe("A meticulous reviewer");
  });

  it("does not include description key when agent has no description", () => {
    const agent = makeAgent({ description: undefined });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0]).not.toHaveProperty("description");
  });

  // ── Tool-to-group mapping tests ─────────────────────────────────────────

  it("maps Read tool to 'read' group", () => {
    const agent = makeAgent({ tools: ["Read"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("read");
  });

  it("maps Glob tool to 'read' group", () => {
    const agent = makeAgent({ tools: ["Glob"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("read");
  });

  it("maps Grep tool to 'read' group", () => {
    const agent = makeAgent({ tools: ["Grep"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("read");
  });

  it("maps Edit tool to 'edit' group", () => {
    const agent = makeAgent({ tools: ["Edit"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("edit");
  });

  it("maps Write tool to 'edit' group", () => {
    const agent = makeAgent({ tools: ["Write"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("edit");
  });

  it("maps Bash tool to 'command' group", () => {
    const agent = makeAgent({ tools: ["Bash"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toContain("command");
  });

  it("deduplicates groups when multiple tools map to the same group", () => {
    const agent = makeAgent({ tools: ["Read", "Glob", "Grep"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    const readGroups = parsed.customModes[0].groups.filter((g: string) => g === "read");
    expect(readGroups).toHaveLength(1);
  });

  it("produces multiple groups when tools span different categories", () => {
    const agent = makeAgent({ tools: ["Read", "Edit", "Bash"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    const groups = parsed.customModes[0].groups;
    expect(groups).toContain("read");
    expect(groups).toContain("edit");
    expect(groups).toContain("command");
  });

  it("defaults to read group when agent has no tools", () => {
    const agent = makeAgent({ tools: undefined });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toEqual(["read"]);
  });

  it("defaults to read group when agent has empty tools array", () => {
    const agent = makeAgent({ tools: [] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toEqual(["read"]);
  });

  it("defaults to read group when all tools have no known mapping", () => {
    const agent = makeAgent({ tools: ["UnknownTool"] });
    const [output] = rooCodeFormatAgents([agent]);
    const parsed = JSON.parse(output.content);
    expect(parsed.customModes[0].groups).toEqual(["read"]);
  });

  it("content ends with newline", () => {
    const [output] = rooCodeFormatAgents([makeAgent()]);
    expect(output.content.endsWith("\n")).toBe(true);
  });
});

// ── codex-agent-format ─────────────────────────────────────────────────────

describe("codex-agent-format — formatAgents()", () => {
  it("returns empty array for empty agents list", () => {
    expect(codexFormatAgents([])).toEqual([]);
  });

  it("returns exactly one file output for any non-empty agents list", () => {
    const agents = [makeAgent({ name: "agent-a" }), makeAgent({ name: "agent-b" })];
    const outputs = codexFormatAgents(agents);
    expect(outputs).toHaveLength(1);
  });

  it("output filename is AGENTS.md", () => {
    const [output] = codexFormatAgents([makeAgent()]);
    expect(output.filename).toBe("AGENTS.md");
  });

  it("content contains the generated-by comment header", () => {
    const [output] = codexFormatAgents([makeAgent()]);
    expect(output.content).toContain("<!-- Generated by mcpman agent sync.");
  });

  it("each agent appears as a # heading with its name", () => {
    const [output] = codexFormatAgents([makeAgent({ name: "code-reviewer" })]);
    expect(output.content).toContain("# code-reviewer");
  });

  it("each agent has a ## Role section", () => {
    const [output] = codexFormatAgents([makeAgent()]);
    expect(output.content).toContain("## Role");
  });

  it("## Role section contains the agent's role text", () => {
    const agent = makeAgent({ role: "You must review code for security issues." });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).toContain("You must review code for security issues.");
  });

  it("includes description paragraph after # heading when agent has description", () => {
    const agent = makeAgent({ description: "Focused on security review." });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).toContain("Focused on security review.");
  });

  it("does not include description section when agent has no description", () => {
    const agent = makeAgent({ description: undefined });
    const [output] = codexFormatAgents([agent]);
    // The content should have the heading and Role section but not a stray description
    const lines = output.content.split("\n");
    const headingIdx = lines.findIndex((l) => l === "# my-agent");
    // Next non-empty line after heading (when no description) should be blank then ## Role
    const nextNonEmpty = lines.slice(headingIdx + 1).find((l) => l.trim() !== "");
    expect(nextNonEmpty).toBe("## Role");
  });

  it("includes ## Instructions section when agent has instructions", () => {
    const agent = makeAgent({ instructions: "Always check for XSS vulnerabilities." });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).toContain("## Instructions");
    expect(output.content).toContain("Always check for XSS vulnerabilities.");
  });

  it("does not include ## Instructions section when agent has no instructions", () => {
    const agent = makeAgent({ instructions: undefined });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).not.toContain("## Instructions");
  });

  it("merges multiple agents into a single AGENTS.md file", () => {
    const agents = [
      makeAgent({ name: "reviewer", role: "Review carefully." }),
      makeAgent({ name: "tester", role: "Test thoroughly." }),
    ];
    const [output] = codexFormatAgents(agents);
    expect(output.content).toContain("# reviewer");
    expect(output.content).toContain("Review carefully.");
    expect(output.content).toContain("# tester");
    expect(output.content).toContain("Test thoroughly.");
  });

  it("separates multiple agents with --- horizontal rule", () => {
    const agents = [makeAgent({ name: "agent-a" }), makeAgent({ name: "agent-b" })];
    const [output] = codexFormatAgents(agents);
    expect(output.content).toContain("---");
  });

  it("trims whitespace from role content", () => {
    const agent = makeAgent({ role: "  Trimmed role.  " });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).toContain("Trimmed role.");
    expect(output.content).not.toContain("  Trimmed role.  ");
  });

  it("trims whitespace from instructions content", () => {
    const agent = makeAgent({ instructions: "\n  Follow the style guide.  \n" });
    const [output] = codexFormatAgents([agent]);
    expect(output.content).toContain("Follow the style guide.");
  });

  it("content ends with newline", () => {
    const [output] = codexFormatAgents([makeAgent()]);
    expect(output.content.endsWith("\n")).toBe(true);
  });
});
