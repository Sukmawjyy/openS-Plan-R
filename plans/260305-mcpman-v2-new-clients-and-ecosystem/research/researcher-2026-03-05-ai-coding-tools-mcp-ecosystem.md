# AI Coding Tools & MCP Ecosystem — March 2026

**Date:** 2026-03-05
**Scope:** Claude Code, OpenCode, Roo Code, OpenAI Codex CLI, notable MCP servers, ecosystem trends

---

## 1. Claude Code

**Status:** Active, production — v2.1.69 (latest as of research date)
**Type:** Terminal-based agentic coding CLI by Anthropic
**Model:** Claude Opus 4.6 (frontier) / Claude Sonnet 4.6

### Key Features (Recent)
- **Auto-memory** — automatically saves session context; managed via `/memory` command
- **MCP Tool Search + lazy loading** — reduces context usage by up to 95%; MCP servers no longer bloat context on load
- **Dynamic MCP updates** — supports `list_changed` notifications; servers can add/remove tools without disconnect/reconnect
- **HTTP hooks** — POST JSON to URL endpoints instead of shell commands; enables webhook-style automation
- **Parallel subagents** — up to 7 simultaneous agents (Explore, Plan, General-purpose modes)
- **Voice STT** — 20 languages supported
- **`/remote-control`** — external build integration; serves local environment to claude.ai
- **MCP OAuth improvements** — manual URL paste fallback when localhost redirect fails
- **Plugin system** — `/reload-plugins` hot-reloads without restart
- **`/copy` command** — interactive picker for selecting code blocks from responses

### MCP Role
Claude Code is simultaneously an **MCP client** (consumes MCP servers) AND an **MCP server** (exposes tools: Bash, Read, Write, Edit, Grep to other agents). This dual role is unique in the ecosystem.

### MCP Scoping
- `local` — current project only (you)
- `project` — team-shared via `.mcp.json`
- `user` — all projects (global)

### Differentiators
- Largest context window (~150K tokens) vs Cursor/Windsurf
- SWE-bench leader (Opus 4.6) for real-world coding tasks
- No IDE required — pure terminal; pairs with any editor
- Acts as orchestrator of other AI agents via subagent spawning
- Figma integration via MCP (design-to-code workflow)

### Pricing
- Pro: ~$20/month; Max plan tiers: $100–$200/month

---

## 2. OpenCode

**Status:** Active open-source — 95K+ GitHub stars, hundreds of contributors
**Type:** Terminal-based AI coding agent (Go)
**UI:** TUI via Bubble Tea framework; also available as desktop app + VS Code/Cursor extension

### Key Features
- **75+ LLM providers** — Claude, GPT-4, Gemini, Bedrock, Groq, Azure OpenAI, OpenRouter, local models; zero vendor lock-in
- **LSP integration** — Language Server Protocol for Rust, Swift, Terraform, TypeScript, PyRight and others; enables real code intelligence beyond text completion
- **Session management** — persistent SQLite storage; shareable session links
- **Privacy-first** — no code/context stored on OpenCode servers; user controls sharing
- **ACP (Agent Client Protocol)** — compatible with JetBrains, Zed, Neovim, Emacs
- **MCP support** — both local (stdio) and remote MCP servers supported

### MCP Support
Configured via project config with `mcpServers` section. Developers are warned that some servers (especially GitHub MCP) add significant tokens to context.

### Differentiators
- Most multi-provider flexible tool in the ecosystem
- Best for privacy-sensitive environments (no data retention)
- LSP-backed code intelligence vs pure LLM context in competitors
- Open-source — fully auditable, self-hostable
- Not Anthropic/OpenAI locked

### Limitation
- No built-in MCP marketplace — server discovery is manual
- Power-user oriented; steeper setup curve vs Claude Code or Cursor

---

## 3. Roo Code (formerly Roo Cline)

**Status:** Active VS Code extension — maintained by RooCodeInc
**Type:** VS Code AI coding agent extension
**Origin:** Fork/evolution of Cline (Claude Dev)

### Key Features
- **Boomerang Tasks (Orchestrator Mode)** — complex tasks decomposed into subtasks; each subtask runs in its own context with a specialized mode (Code, Architect, Debug); parent pauses, child completes, parent resumes with summary only; prevents context blowout on long tasks
- **Multi-model per mode** — assign different providers/models to different modes (e.g., cheap model for quick tasks, Opus for planning)
- **MCP support** — global config (`mcp_settings.json`) + project-level (`.roo/mcp.json`); team-shareable
- **Custom modes** — create specialized AI personas for different task types
- **Context indexing** — maintains consistency as work passes between modes

### MCP Support
Full MCP support with both global and project-scoped config. No MCP marketplace (unlike Cline which launched one in Feb 2025). Manual server discovery required.

### vs Cline
| Feature | Roo Code | Cline |
|---|---|---|
| Multi-agent orchestration | Boomerang mode (built-in) | External via MCP |
| MCP marketplace | No | Yes (since v3.4) |
| Custom modes | Yes | Limited |
| Model flexibility | Per-mode assignment | Single model |

### Differentiators
- Boomerang/Orchestrator mode is the most sophisticated built-in multi-agent workflow of any VS Code extension
- Designed as "a whole dev team in your editor" — specialized agents, not a single assistant
- Best for SPARC/complex multi-step workflows within VS Code

---

## 4. OpenAI Codex CLI

**Status:** Active — maintained by OpenAI
**Type:** Terminal-based AI coding CLI (parallel to Claude Code)
**Model:** Codex (o-series reasoning models)

### Key Features
- **MCP support** — both stdio and Streamable HTTP servers; configured via `config.toml`
- **AGENTS.md** — project-level instruction file (analogous to Claude Code's CLAUDE.md)
- **Agents SDK integration** — Codex can be orchestrated as a component in larger agent pipelines
- **Todo list tracking** — built-in progress tracking for multi-step tasks
- **Web search** — native tool without MCP
- **Tool filtering** — `enabled_tools`/`disabled_tools` per MCP server for fine-grained control

### MCP Configuration
```toml
# ~/.codex/config.toml
[mcp_servers.context7]
type = "stdio"
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.figma]
type = "http"
url = "https://figma-mcp.example.com"
bearer_token_env_var = "FIGMA_TOKEN"
```

### Figma + Codex via MCP
Figma officially integrated with both Claude Code and Codex via MCP — captures production/staging interfaces and converts to editable Figma frames.

### Differentiators
- Best integration with OpenAI's own ecosystem (Docs MCP, Agents SDK)
- AGENTS.md pattern is clean for project-level customization
- Streamable HTTP MCP is first-class (not just stdio)
- Weaker on raw benchmark scores vs Claude Opus 4.6 for SWE tasks

---

## 5. Notable MCP Servers (Community + Official)

Based on FastMCP data (1,864+ servers tracked, real usage stats):

| Rank | Server | Category | Views | Key Value |
|---|---|---|---|---|
| 1 | **Context7** | Docs/Memory | 11,000 | Injects version-specific live docs into prompt — kills hallucinations on API changes |
| 2 | **Playwright (Microsoft)** | Browser | 5,600 | Accessibility-tree browser control; deterministic, no flaky screenshots |
| 3 | **Sequential Thinking** | AI Reasoning | 5,500 | Structured step-by-step reasoning; Anthropic-built |
| 4 | **ReactBits** | UI/Design | 4,800 | 135+ animated React components on demand |
| 5 | **Playwright (executeautomation)** | Browser | 4,700 | Multi-page workflows + screenshot validation |
| 6 | **Puppeteer** | Browser | 4,200 | Screenshot + JS execution via DevTools Protocol |
| 7 | **GitHub** | Dev Tools | 3,100 | Full repo/PR/issue/workflow read-write access |
| 8 | **Desktop Commander** | Filesystem | ~2,800 | Terminal commands with explicit approval controls |
| 9 | **Docfork** | Docs | 2,800 | Up-to-date library docs; anti-hallucination |
| 10 | **DeepWiki** | Docs | 2,400 | Knowledge base → clean Markdown |

### Additional Tier-2 Servers Worth Noting
- **Filesystem (official)** — directory-sandboxed file access; security-safe for agent use
- **PostgreSQL/SQLite MCP** — natural language DB queries
- **Firecrawl/Jina Reader** — URL → clean Markdown for research agents
- **E2B** — sandboxed Python/JS execution; safe code running without local risk
- **Memory (knowledge graph)** — persistent cross-session memory via graph store
- **Figma MCP** — live design data for design-to-code; official Figma integration
- **GPT Researcher** — deep research with cited reports
- **Magic UI MCP** — React/Tailwind component patterns
- **Microsoft MCP suite** — 10 official servers covering Azure, M365, DevOps

### Browser Automation Dominance
3 of top 10 servers are browser automation — reflecting strong demand for AI-driven testing, scraping, and UI validation workflows.

---

## 6. MCP Ecosystem Trends (2026)

### Standardization Won
MCP was donated to the **Agentic AI Foundation** (under Linux Foundation) on Dec 9, 2025 — vendor-neutral governance secured. OpenAI, Anthropic, Hugging Face, LangChain all standardized on MCP.

### Growth Numbers
- Downloads: ~100K (Nov 2024) → **8M+ (Apr 2025)**
- Total servers: **5,800+**
- Total clients: **300+**
- Market size: $1.8B projected (2025)

### Key 2026 Trends
1. **Enterprise adoption** — 2025 was experimentation; 2026 is enterprise rollout. Healthcare, finance, manufacturing leading.
2. **Remote/HTTP MCP dominance** — HTTP transport replacing stdio as primary for cloud-based services; enables multi-tenant server hosting
3. **Context efficiency** — lazy loading, tool search, and selective loading becoming critical as server counts grow; Claude Code's 95% context reduction via lazy MCP loading is the pattern to follow
4. **Agent-to-agent orchestration** — tools like Claude Code (MCP server + client), Roo Code (Boomerang), OpenCode (ACP) enabling AI agents to spawn and coordinate other AI agents
5. **Security hardening** — tool overexposure, prompt injection via MCP tools, and sandboxing are active attack surfaces; Desktop Commander's approval-gate model is emerging best practice
6. **IDE vs terminal split** — Cursor/Windsurf/Roo Code own IDE-native users; Claude Code/OpenCode/Codex CLI own terminal-native/devops users; tools increasingly compatible rather than competing

### The M+N Problem Solved
MCP converted M×N integrations (every AI × every tool) to M+N (each integrates once). This is why adoption is near-universal — the economic incentive to implement once is overwhelming.

---

## 7. Interoperability Matrix

| Tool | MCP Client | MCP Server | Multi-Agent | IDE/Terminal |
|---|---|---|---|---|
| Claude Code | Yes | Yes (dual) | Yes (7 parallel) | Terminal |
| OpenCode | Yes | No | No (single session) | Terminal + IDE ext |
| Roo Code | Yes | No | Yes (Boomerang) | VS Code |
| Codex CLI | Yes | No | Via Agents SDK | Terminal |
| Cursor | Partial | No | No | IDE |
| Windsurf | Partial | No | No | IDE |

### Complementary Workflows
- **Claude Code + Roo Code**: Claude Code as orchestrator spawning Roo Code agents for VS Code-specific tasks
- **Context7 + any tool**: Universal documentation freshness layer — works with all clients
- **Sequential Thinking + Claude Code**: Better reasoning on architecture decisions
- **E2B + Codex**: Safe code execution sandbox for Codex-generated scripts
- **Figma MCP + Claude Code/Codex**: Design-to-code pipeline (officially supported)

---

## Unresolved Questions

1. **OpenCode ACP vs MCP** — Agent Client Protocol compatibility with MCP ecosystem is unclear; does ACP subsume MCP or complement it?
2. **Roo Code v3 timeline** — No confirmed v3 release date; Boomerang is current flagship but roadmap post-v2.2 not publicly detailed
3. **MCP security standard** — Linux Foundation governance announced but formal security spec for MCP tool sandboxing not yet published; current best practices are tool-level, not protocol-level
4. **Claude Code as MCP server stability** — dual client+server mode is documented but marked as experimental capability in some sources; production-readiness unclear
5. **OpenCode "Crush" successor** — original Go-based OpenCode was archived Sep 2025 and succeeded by "Crush" (Charm team collaboration); relationship between opencode.ai (active) and archived repo needs clarification — likely a new project under same brand

---

*Sources consulted: Anthropic Claude Code changelog, opencode.ai docs, RooCodeInc GitHub/docs, OpenAI Codex developer docs, FastMCP popularity data, InfoQ OpenCode report, Builder.io MCP server roundup, CData/Thoughtworks MCP trend analysis*
