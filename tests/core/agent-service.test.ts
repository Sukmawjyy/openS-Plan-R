/**
 * agent-service.test.ts
 * Tests for agent-service.ts: syncAgentsToClient, listAgentsFromSpec, exportAgents.
 * Uses real temp directories for isolation — no fs mocks needed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  syncAgentsToClient,
  listAgentsFromSpec,
  exportAgents,
} from "../../src/core/agent-service.js";
import type { AgentSpec, SkillSpec } from "../../src/core/skill-types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcpman-agent-test-"));
}

function makeAgent(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    name: "test-agent",
    role: "You are a test agent.",
    ...overrides,
  };
}

function makeSpec(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    name: "test-skill",
    version: "1.0.0",
    rules: [{ name: "rule-one", content: "Always write tests." }],
    ...overrides,
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTmpDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── syncAgentsToClient ─────────────────────────────────────────────────────

describe("syncAgentsToClient()", () => {
  it("returns empty array when agents list is empty", () => {
    const written = syncAgentsToClient("claude-code", [], tmpDir);
    expect(written).toEqual([]);
  });

  it("throws when clientType has no agent format adapter", () => {
    const agents = [makeAgent()];
    expect(() => syncAgentsToClient("cursor", agents, tmpDir)).toThrow(
      /No agent format adapter available for client/,
    );
  });

  it("throws for claude-desktop which has no agent adapter", () => {
    const agents = [makeAgent()];
    expect(() => syncAgentsToClient("claude-desktop", agents, tmpDir)).toThrow(
      /No agent format adapter available for client/,
    );
  });

  // ── claude-code client ──────────────────────────────────────────────────

  describe("claude-code client", () => {
    it("writes one .md file per agent under .claude/agents/", () => {
      const agents = [makeAgent({ name: "my-agent" })];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      expect(written).toHaveLength(1);
      expect(written[0]).toBe(path.join(tmpDir, ".claude", "agents", "my-agent.md"));
    });

    it("creates the .claude/agents/ directory if it does not exist", () => {
      const agents = [makeAgent({ name: "my-agent" })];
      syncAgentsToClient("claude-code", agents, tmpDir);
      expect(fs.existsSync(path.join(tmpDir, ".claude", "agents"))).toBe(true);
    });

    it("written file actually exists on disk", () => {
      const agents = [makeAgent({ name: "my-agent" })];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      expect(fs.existsSync(written[0])).toBe(true);
    });

    it("writes one file per agent when multiple agents provided", () => {
      const agents = [
        makeAgent({ name: "agent-a" }),
        makeAgent({ name: "agent-b" }),
      ];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      expect(written).toHaveLength(2);
      expect(fs.existsSync(path.join(tmpDir, ".claude", "agents", "agent-a.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".claude", "agents", "agent-b.md"))).toBe(true);
    });

    it("file content contains YAML frontmatter with agent name", () => {
      const agents = [makeAgent({ name: "my-agent" })];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      const content = fs.readFileSync(written[0], "utf-8");
      expect(content).toContain("name: my-agent");
    });

    it("file content contains the agent role", () => {
      const agents = [makeAgent({ role: "You are a senior reviewer." })];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      const content = fs.readFileSync(written[0], "utf-8");
      expect(content).toContain("You are a senior reviewer.");
    });

    it("returns absolute paths for all written files", () => {
      const agents = [makeAgent({ name: "abs-agent" })];
      const written = syncAgentsToClient("claude-code", agents, tmpDir);
      expect(path.isAbsolute(written[0])).toBe(true);
    });
  });

  // ── roo-code client ─────────────────────────────────────────────────────

  describe("roo-code client", () => {
    it("writes a single .roomodes file", () => {
      const agents = [makeAgent({ name: "roo-agent" })];
      const written = syncAgentsToClient("roo-code", agents, tmpDir);
      expect(written).toHaveLength(1);
      expect(written[0]).toBe(path.join(tmpDir, ".roomodes"));
    });

    it("written .roomodes file exists on disk", () => {
      const agents = [makeAgent()];
      const written = syncAgentsToClient("roo-code", agents, tmpDir);
      expect(fs.existsSync(written[0])).toBe(true);
    });

    it("written .roomodes is valid JSON", () => {
      const agents = [makeAgent({ name: "json-agent" })];
      const written = syncAgentsToClient("roo-code", agents, tmpDir);
      const raw = fs.readFileSync(written[0], "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it(".roomodes contains all agents when multiple provided", () => {
      const agents = [
        makeAgent({ name: "agent-one" }),
        makeAgent({ name: "agent-two" }),
      ];
      const written = syncAgentsToClient("roo-code", agents, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(written[0], "utf-8"));
      expect(parsed.customModes).toHaveLength(2);
    });
  });

  // ── codex-cli client ────────────────────────────────────────────────────

  describe("codex-cli client", () => {
    it("writes a single AGENTS.md file", () => {
      const agents = [makeAgent({ name: "codex-agent" })];
      const written = syncAgentsToClient("codex-cli", agents, tmpDir);
      expect(written).toHaveLength(1);
      expect(written[0]).toBe(path.join(tmpDir, "AGENTS.md"));
    });

    it("written AGENTS.md file exists on disk", () => {
      const agents = [makeAgent()];
      const written = syncAgentsToClient("codex-cli", agents, tmpDir);
      expect(fs.existsSync(written[0])).toBe(true);
    });

    it("AGENTS.md contains agent name as section heading", () => {
      const agents = [makeAgent({ name: "my-codex-agent" })];
      const written = syncAgentsToClient("codex-cli", agents, tmpDir);
      const content = fs.readFileSync(written[0], "utf-8");
      expect(content).toContain("# my-codex-agent");
    });

    it("AGENTS.md merges all agents into one file", () => {
      const agents = [
        makeAgent({ name: "agent-alpha" }),
        makeAgent({ name: "agent-beta" }),
      ];
      const written = syncAgentsToClient("codex-cli", agents, tmpDir);
      expect(written).toHaveLength(1);
      const content = fs.readFileSync(written[0], "utf-8");
      expect(content).toContain("# agent-alpha");
      expect(content).toContain("# agent-beta");
    });
  });
});

// ── listAgentsFromSpec ─────────────────────────────────────────────────────

describe("listAgentsFromSpec()", () => {
  it("returns empty array when spec has no agents field", () => {
    const spec = makeSpec();
    expect(listAgentsFromSpec(spec)).toEqual([]);
  });

  it("returns empty array when spec.agents is explicitly undefined", () => {
    const spec = makeSpec({ agents: undefined });
    expect(listAgentsFromSpec(spec)).toEqual([]);
  });

  it("returns empty array when spec.agents is an empty array", () => {
    const spec = makeSpec({ agents: [] });
    expect(listAgentsFromSpec(spec)).toEqual([]);
  });

  it("returns all agents when spec has agents defined", () => {
    const agents: AgentSpec[] = [
      makeAgent({ name: "agent-a" }),
      makeAgent({ name: "agent-b" }),
    ];
    const spec = makeSpec({ agents });
    expect(listAgentsFromSpec(spec)).toHaveLength(2);
  });

  it("returns agents with all their properties intact", () => {
    const agent = makeAgent({
      name: "full-agent",
      description: "A full agent",
      role: "Review code carefully.",
      tools: ["Read", "Grep"],
      model: "balanced",
    });
    const spec = makeSpec({ agents: [agent] });
    const result = listAgentsFromSpec(spec);
    expect(result[0]).toEqual(agent);
  });

  it("returns exactly the agents array reference from the spec", () => {
    const agents: AgentSpec[] = [makeAgent()];
    const spec = makeSpec({ agents });
    const result = listAgentsFromSpec(spec);
    expect(result).toBe(agents);
  });
});

// ── exportAgents ───────────────────────────────────────────────────────────

describe("exportAgents()", () => {
  it("returns empty array when project dir has no .claude/agents directory", () => {
    const result = exportAgents(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when .claude/agents directory is empty", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const result = exportAgents(tmpDir);
    expect(result).toEqual([]);
  });

  it("reads a minimal agent file (no frontmatter) and treats content as role", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "simple-agent.md"), "You are a simple agent.");

    const result = exportAgents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("simple-agent");
    expect(result[0].role).toBe("You are a simple agent.");
  });

  it("reads agent name from filename (strips .md extension)", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "code-reviewer.md"), "Review carefully.");

    const result = exportAgents(tmpDir);
    expect(result[0].name).toBe("code-reviewer");
  });

  it("parses YAML frontmatter and extracts description", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const content = [
      "---",
      "description: Reviews pull requests",
      "---",
      "You are a PR reviewer.",
    ].join("\n");
    fs.writeFileSync(path.join(agentDir, "pr-reviewer.md"), content);

    const result = exportAgents(tmpDir);
    expect(result[0].description).toBe("Reviews pull requests");
  });

  it("parses YAML frontmatter and extracts tools as array", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const content = [
      "---",
      "tools: [Read, Grep, Bash]",
      "---",
      "You are a tool-using agent.",
    ].join("\n");
    fs.writeFileSync(path.join(agentDir, "tool-agent.md"), content);

    const result = exportAgents(tmpDir);
    expect(result[0].tools).toEqual(["Read", "Grep", "Bash"]);
  });

  it("uses body after frontmatter as the agent role", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const content = [
      "---",
      "description: A tester",
      "---",
      "You are a thorough tester who covers edge cases.",
    ].join("\n");
    fs.writeFileSync(path.join(agentDir, "tester.md"), content);

    const result = exportAgents(tmpDir);
    expect(result[0].role).toBe("You are a thorough tester who covers edge cases.");
  });

  it("reads multiple agent files from .claude/agents/", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "agent-a.md"), "Role A.");
    fs.writeFileSync(path.join(agentDir, "agent-b.md"), "Role B.");

    const result = exportAgents(tmpDir);
    expect(result).toHaveLength(2);
    const names = result.map((a) => a.name).sort();
    expect(names).toEqual(["agent-a", "agent-b"]);
  });

  it("ignores non-.md files in .claude/agents/", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "agent.md"), "A real agent.");
    fs.writeFileSync(path.join(agentDir, "config.json"), '{"not": "agent"}');
    fs.writeFileSync(path.join(agentDir, "readme.txt"), "Just notes.");

    const result = exportAgents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("agent");
  });

  it("ignores subdirectories inside .claude/agents/", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(path.join(agentDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(agentDir, "real-agent.md"), "Real role.");

    const result = exportAgents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("real-agent");
  });

  it("trims whitespace from role content", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "spaced.md"), "\n  Trimmed role.  \n");

    const result = exportAgents(tmpDir);
    expect(result[0].role).toBe("Trimmed role.");
  });

  it("handles frontmatter with tools in bracket notation correctly", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const content = "---\ntools: [Edit, Write]\n---\nAgent role.";
    fs.writeFileSync(path.join(agentDir, "writer.md"), content);

    const result = exportAgents(tmpDir);
    expect(result[0].tools).toEqual(["Edit", "Write"]);
  });

  it("silently skips files that cannot be read", () => {
    const agentDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    // Write a valid agent alongside an unreadable directory (to trigger skip)
    fs.writeFileSync(path.join(agentDir, "good-agent.md"), "Good role.");

    const result = exportAgents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("good-agent");
  });
});
