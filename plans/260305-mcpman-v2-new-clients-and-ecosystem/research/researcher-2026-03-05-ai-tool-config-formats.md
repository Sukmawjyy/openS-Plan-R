# AI Coding Tool Config Formats — Technical Reference (Mar 2026)

> Research for designing a universal spec that maps across all major tools.
> Sacrifice grammar for concision. Unresolved questions listed at end.

---

## 1. Claude Code

### Directory Structure

```
~/.claude/                          # User-level (global)
├── settings.json                   # Global settings
├── CLAUDE.md                       # Global memory/instructions
├── agents/                         # User-level subagents
│   └── <name>.md
└── plans/                          # Plan files

.claude/                            # Project-level (git-tracked)
├── settings.json                   # Shared project settings
├── settings.local.json             # Local overrides (gitignored)
├── CLAUDE.md                       # Project memory
├── CLAUDE.local.md                 # Local memory (gitignored)
├── agents/                         # Project-level subagents
│   └── <name>.md
├── mcp.json                        # Project MCP servers (shared)
└── backups/                        # Auto-timestamped config backups

~/.claude.json                      # Stores local/user MCP scope servers
```

### CLAUDE.md — No formal schema

Plain markdown. Used as persistent context injected into every session.
Typically organized with sections: role, rules, project structure, conventions.
No frontmatter. No character limit documented.

Lookup chain (merged, higher wins):
1. `~/.claude/CLAUDE.md` (user global)
2. `.claude/CLAUDE.md` OR `CLAUDE.md` in project root
3. `CLAUDE.local.md` / `.claude/CLAUDE.local.md` (local, not shared)

### settings.json — Full schema (key fields)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",

  "permissions": {
    "allow": ["Bash(npm run *)", "Read(~/.zshrc)"],
    "ask":   ["Bash(git push *)"],
    "deny":  ["Bash(curl *)", "Read(./.env*)", "WebFetch"],
    "additionalDirectories": ["../docs/"],
    "defaultMode": "acceptEdits",          // default|acceptEdits|dontAsk|bypassPermissions|plan
    "disableBypassPermissionsMode": "disable"
  },

  "sandbox": {
    "enabled": false,
    "filesystem": {
      "allowWrite": ["//tmp/build"],
      "denyWrite": ["//etc"],
      "denyRead": ["~/.aws/credentials"]
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"]
    }
  },

  "env": { "MY_VAR": "value" },

  "model": "claude-sonnet-4-6",            // or alias: sonnet|opus|haiku
  "availableModels": ["sonnet", "haiku"],

  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "SubagentStart": [...],
    "SubagentStop": [...],
    "Stop": [...]
  },

  "includeCoAuthoredBy": true,
  "cleanupPeriodDays": 30,
  "respectGitignore": true,
  "language": "english",
  "outputStyle": "Explanatory",

  "enabledMcpjsonServers": ["memory", "github"],
  "disabledMcpjsonServers": ["filesystem"]
}
```

Scope precedence (highest → lowest):
1. Managed settings (MDM/server-deployed)
2. CLI flags
3. `.claude/settings.local.json`
4. `.claude/settings.json`
5. `~/.claude/settings.json`

Array values **merge** across scopes; they don't replace.

### .mcp.json — Project MCP servers

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GH_TOKEN}" }
    },
    "local-tool": {
      "command": "/path/to/server",
      "args": ["--flag"],
      "env": { "KEY": "${MY_ENV_VAR:-default}" }
    }
  }
}
```

Transport types: `http` (preferred), `sse` (deprecated), `stdio` (implicit when `command` present).
Env var expansion: `${VAR}` and `${VAR:-default}` supported in `command`, `args`, `env`, `url`, `headers`.
Stored at `.mcp.json` in project root (project scope) or `~/.claude.json` (user/local scope).

### Subagent definitions — Markdown + YAML frontmatter

File: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)

```markdown
---
name: code-reviewer          # required; lowercase, hyphens
description: Reviews code for quality. Use proactively after any code change.  # required
tools: Read, Glob, Grep, Bash   # optional; inherits all if omitted
disallowedTools: Write, Edit    # optional denylist
model: sonnet                   # optional: sonnet|opus|haiku|inherit (default: inherit)
permissionMode: default         # optional: default|acceptEdits|dontAsk|bypassPermissions|plan
maxTurns: 10                    # optional: max agentic turns
skills:                         # optional: skill names to preload
  - api-conventions
mcpServers:                     # optional: inline or named MCP servers
  - slack
memory: user                    # optional: user|project|local (enables persistent memory)
background: false               # optional: run as background task
isolation: worktree             # optional: run in isolated git worktree
hooks:                          # optional: lifecycle hooks scoped to this subagent
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
---

You are a senior code reviewer. When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Report critical issues, warnings, suggestions
```

CLI session-only (JSON, not saved to disk):
```bash
claude --agents '{"reviewer": {"description": "...", "prompt": "...", "tools": ["Read"]}}'
```

---

## 2. Roo Code

### Directory Structure

```
~/.roo/                             # Global user-level
├── rules/                          # Global rules (all modes, all projects)
│   └── *.md / *.txt
└── rules-{modeSlug}/               # Global mode-specific rules

project-root/
├── .roomodes                       # Project custom mode definitions (YAML or JSON)
├── .roo/
│   ├── mcp.json                    # Project MCP servers
│   ├── rules/                      # Project-level rules (all modes)
│   │   ├── 01-general.md
│   │   └── 02-style.txt
│   └── rules-{modeSlug}/           # Mode-specific rules
│       └── 01-specific.md
├── .roorules                       # Fallback single-file global rules
└── .roorules-{modeSlug}            # Fallback mode-specific single file
```

Rules loaded in order: global → project → mode-specific. Alphabetical within directories.
Project rules take precedence over global when conflicts occur.

### .roomodes — Custom mode definitions

**YAML format (preferred):**
```yaml
customModes:
  - slug: "my-writer"              # required; /^[a-zA-Z0-9-]+$/
    name: "Technical Writer"       # required; display name, emoji ok
    description: "Docs writing"   # required; shown in mode selector
    roleDefinition: |              # required; system prompt identity
      You are an expert technical writer...
    whenToUse: "Use for docs tasks"  # optional; orchestration guidance
    customInstructions: "Use active voice"  # optional; extra rules
    groups:
      - "read"                     # file reading access
      - - "edit"                   # edit with file restrictions
        - fileRegex: '\.(md|mdx)$'
          description: "Markdown only"
      - "command"                  # execute shell commands
      - "mcp"                      # MCP tool access
```

**JSON format (equivalent):**
```json
{
  "customModes": [{
    "slug": "my-writer",
    "name": "Technical Writer",
    "description": "Docs writing",
    "roleDefinition": "You are an expert technical writer...",
    "whenToUse": "Use for docs tasks",
    "customInstructions": "Use active voice",
    "groups": [
      "read",
      ["edit", { "fileRegex": "\\.(md|mdx)$", "description": "Markdown only" }],
      "command",
      "mcp"
    ]
  }]
}
```

Groups available: `"read"`, `"edit"`, `"command"`, `"mcp"`, `"browser"`
Regex escaping: single `\` in YAML, double `\\` in JSON.
Format auto-detected (YAML first). Editing via UI converts JSON → YAML.

**Precedence:** Project `.roomodes` > Global `custom_modes.yaml` / `custom_modes.json` > Built-in modes.
Project modes **fully override** (no property merging) matching global modes.

### mcp.json — Project MCP servers (Roo Code)

Located at `.roo/mcp.json`. Same `mcpServers` object structure as Claude Code's `.mcp.json`:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@some/mcp-server"],
      "env": { "API_KEY": "value" },
      "disabled": false,
      "alwaysAllow": ["tool-name"]
    }
  }
}
```

Global MCP: `mcp_settings.json` in VS Code extension global settings directory.

---

## 3. OpenAI Codex CLI

### Directory Structure

```
~/.codex/                           # User-level
├── config.toml                     # User configuration
└── AGENTS.md                       # Global instructions (optional)

.codex/                             # Project-level (trusted projects only)
├── config.toml                     # Project config overrides
└── AGENTS.md                       # Project instructions (optional)

/etc/codex/config.toml              # System-level config (Unix)
```

Config precedence (highest → lowest):
1. CLI flags / `--config` override
2. Profile values (`--profile <name>`)
3. Project `.codex/config.toml` (closest dir wins)
4. User `~/.codex/config.toml`
5. System `/etc/codex/config.toml`
6. Built-in defaults

### config.toml — Full schema (key sections)

```toml
# Core model settings
model = "gpt-5.2"
model_provider = "openai"
model_reasoning_effort = "high"       # low|medium|high
plan_mode_reasoning_effort = "medium" # plan mode override

# Security & sandbox
sandbox_mode = "workspace-write"      # read-only|workspace-write|danger-full-access
approval_policy = "on-request"        # controls command approval prompting

# Web search
web_search = "cached"                 # disabled|cached|live

# UI
personality = "friendly"
tui.notifications = true
tui.animations = true
tui.alternate_screen = true

# History
history.persistence = "save-all"      # save-all|none
history.max_bytes = 10485760
sqlite_home = "~/.codex/state.db"

# Shell environment
[shell_environment_policy]
include_only = ["PATH", "HOME", "TERM"]

# Feature flags
[features]
shell_tool = true
web_search = true
multi_agent = true
shell_snapshot = true
collaboration_modes = true
apply_patch_freeform = false          # experimental
unified_exec = false                  # experimental

# MCP servers
[mcp_servers.my-server]
command = "npx"
args = ["-y", "@some/mcp-server"]
env = { API_KEY = "value" }

# Custom model providers
[model_providers.my-provider]
base_url = "https://api.example.com/v1"
api_key = "${MY_API_KEY}"
# headers = { "X-Custom": "value" }

# Project trust
[projects."/path/to/project"]
trust_level = "trusted"               # trusted|untrusted

# Named profiles (override any top-level key)
[profiles.strict]
sandbox_mode = "read-only"
approval_policy = "always"

# Multi-agent roles
[agents]
max_threads = 4
# role configs per agent type
```

### AGENTS.md — Project instructions

Plain markdown. No frontmatter. No schema.

Discovery chain (merged from root → current dir):
1. `~/.codex/AGENTS.md` (global)
2. `AGENTS.override.md` at each level (takes precedence over standard file)
3. `AGENTS.md` walking from git root → current working directory

Configurable fallback filenames:
```toml
project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]
project_doc_max_bytes = 65536   # default; controls max bytes read
```

Purpose: behavioral context ("always run tests before PRs"), not system settings.
Each file is concatenated; closer files override earlier guidance.

---

## 4. Cursor

### Directory Structure

```
.cursor/
└── rules/                          # Project rules directory (git-tracked)
    ├── react-patterns.mdc          # MDC format rules
    ├── api-guidelines.md           # Plain markdown also accepted
    └── frontend/
        └── components.mdc          # Subdirectory organization supported

~/.cursor/rules/                    # User-level global rules
```

Legacy (deprecated, avoid): `.cursorrules` at project root (plain markdown, no frontmatter).

### .mdc Rule File Format

Extension `.mdc` enables structured YAML frontmatter:

```markdown
---
description: "Standards for React components"
globs: ["src/components/**/*.tsx", "src/hooks/**/*.ts"]
alwaysApply: false
---

## Component Rules

- Use functional components only
- Always define PropTypes or TypeScript interfaces
- Extract complex logic to custom hooks

@service-template.ts  <- referenced files included as context when rule triggers
```

**Frontmatter fields:**

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | When rule applies (used for Model Decision mode) |
| `globs` | string[] | Gitignore-style patterns; rule activates when matching files in context |
| `alwaysApply` | boolean | Include in every AI request regardless of context |

**Activation modes (set via UI type dropdown):**

| Mode | Mechanism |
|------|-----------|
| Always Apply | `alwaysApply: true` |
| Auto (model decides) | Agent evaluates `description` for relevance |
| Glob | Activates when files matching `globs` patterns are in context |
| Manual | User invokes via `@rule-name` in chat |

Plain `.md` files in `.cursor/rules/` work as always-on rules without frontmatter.

No documented character limit per rule file; total context budget applies.

---

## 5. Windsurf

### Directory Structure

```
~/ (global)
└── global_rules.md                 # Global rules (all workspaces)

project-root/ (workspace-level)
└── .windsurf/
    └── rules/                      # Workspace rules directory
        ├── style-guide.md
        └── api-conventions.md

any-subdirectory/
└── .windsurf/
    └── rules/                      # Subdirectory-scoped rules
        └── component-rules.md

AGENTS.md (in any directory)        # Directory-scoped auto-applied instructions
```

Rule discovery: `.windsurf/rules` in current workspace + subdirectories + parent dirs up to git root.

### Rule File Format

Plain markdown. No frontmatter in file-based rules.
Character limit: **12,000 chars per file** (individual), **12,000 chars total** combined (global + local).

```markdown
# API Guidelines

<coding-standards>
- Use snake_case for Python, camelCase for JS
- Always handle exceptions
- Document public APIs
</coding-standards>

<testing>
- Unit tests required for all business logic
- Use pytest fixtures for setup
</testing>
```

Best practices: bullet points, numbered lists, XML grouping tags.

**Activation modes (configured via UI, not frontmatter):**

| Mode | Behavior |
|------|----------|
| Always On | Applied to every request |
| Model Decision | Cascade reads description, decides when relevant |
| Glob | Applied when files match patterns (e.g., `*.js`, `src/**/*.ts`) |
| Manual | User invokes via `@mention` in Cascade |

**global_rules.md:** Located in Windsurf settings; accessed via "Manage memories" > "Edit global rules". Same plain markdown format.

### AGENTS.md (Windsurf)

Plain markdown, no frontmatter. Auto-applied based on file location (no explicit config needed).
Root `AGENTS.md` = global scope. Subdirectory `AGENTS.md` = scoped to that subtree.
Windsurf searches parent dirs up to git root.

No character limit documented for AGENTS.md specifically.

---

## 6. Continue

### Directory Structure

```
~/.continue/                        # User-level (global)
├── config.yaml                     # Primary config (YAML preferred, replacing JSON)
├── config.json                     # Legacy format (still supported)
└── config.ts                       # Advanced programmatic config

project-root/
└── .continuerc.json                # Workspace overrides (json only)
```

### config.yaml — Full schema

```yaml
name: my-config
version: 0.0.1
schema: v1

# Language model providers
models:
  - name: GPT-4
    provider: openai               # openai|anthropic|ollama|gemini|mistral|etc.
    model: gpt-4
    apiKey: ${OPENAI_API_KEY}
    roles:                         # chat|autocomplete|embed|rerank|edit|apply|summarize
      - chat
      - edit
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000
    requestOptions:
      headers:
        X-Custom-Header: value

# Context providers
context:
  - provider: codebase
    params:
      nRetrieve: 30
      nFinal: 3
  - provider: docs
  - provider: diff
  - provider: file
  - provider: url
  - provider: open
  - provider: search

# Rules (system prompt additions)
rules:
  - "Always give concise responses"
  - "Prefer TypeScript over JavaScript"

# Slash commands / prompts
prompts:
  - name: check
    description: Check for mistakes in selected code
    prompt: |
      Please check the following code for mistakes and concisely explain them:
      {{{ input }}}

# Documentation sources
docs:
  - name: nest.js
    startUrl: https://docs.nestjs.com/
    faviconUrl: https://nestjs.com/img/logo-small.svg

# MCP servers
mcpServers:
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /path/to/db.sqlite
    env:
      KEY: value
```

**Note:** `slashCommands` from legacy `config.json` are **deprecated** in YAML schema. Custom prompts use `prompts:` instead.

### .continuerc.json — Workspace overrides

```json
{
  "tabAutocompleteOptions": {
    "disable": true
  },
  "mergeBehavior": "overwrite"    // overwrite|merge (default: merge)
}
```

---

## Comparison Table

| Aspect | Claude Code | Roo Code | Codex CLI | Cursor | Windsurf | Continue |
|--------|------------|----------|-----------|--------|----------|---------|
| **Primary config format** | JSON (`settings.json`) | YAML/JSON (`.roomodes`) | TOML (`config.toml`) | MDC frontmatter | Plain MD | YAML (`config.yaml`) |
| **Instruction file** | `CLAUDE.md` | `.roo/rules/*.md` | `AGENTS.md` | `.cursor/rules/*.mdc` | `.windsurf/rules/*.md` | `rules:` in config |
| **Instruction format** | Plain markdown | Plain markdown | Plain markdown | Markdown + YAML frontmatter | Plain markdown | Plain string list |
| **Instruction scoping** | Global → Project → Local | Global → Project → Mode-specific | Global → Project dir | Always/Glob/Auto/Manual | Always/Glob/Auto/Manual | Single scope |
| **Agent/mode definition** | Markdown + YAML frontmatter | YAML/JSON in `.roomodes` | TOML `[agents]` section | N/A | N/A | N/A |
| **Agent definition location** | `.claude/agents/*.md` | `.roomodes` (project) | `~/.codex/config.toml` | N/A | N/A | N/A |
| **MCP config file** | `.mcp.json` | `.roo/mcp.json` | TOML `[mcp_servers.*]` | N/A | External | `mcpServers:` in config |
| **MCP format** | JSON `{mcpServers: {...}}` | JSON `{mcpServers: {...}}` | TOML table | N/A | UI-managed | YAML list |
| **Project-level config** | `.claude/settings.json` | `.roomodes` | `.codex/config.toml` | `.cursor/rules/` | `.windsurf/rules/` | `.continuerc.json` |
| **User-level config** | `~/.claude/settings.json` | `~/.roo/rules/` | `~/.codex/config.toml` | `~/.cursor/rules/` | `global_rules.md` | `~/.continue/config.yaml` |
| **Rule file extension** | `.md` | `.md`, `.txt` | `.md` | `.mdc`, `.md` | `.md` | N/A (inline) |
| **Rule char limit** | None documented | None documented | Configurable bytes | None documented | 12,000/file | N/A |
| **Model selection in config** | `"model": "sonnet"` | Per-mode via UI | `model = "gpt-5.2"` | Settings UI | Settings UI | Per-model in `models:` |
| **Tool/permission control** | `permissions.allow/deny` | `groups: [read, edit, command, mcp]` | `sandbox_mode` | N/A | N/A | N/A |
| **Hooks/lifecycle** | `hooks` in `settings.json` | N/A | N/A | N/A | `.windsurf/cascade/hooks` | N/A |
| **Memory/persistence** | `memory: user\|project\|local` in agent | Auto-memories feature | History persistence | N/A | Cascade Memories | N/A |
| **Env var expansion in config** | `${VAR}` and `${VAR:-default}` | No | `${VAR}` | No | No | `${VAR}` (in apiKey) |
| **AGENTS.md support** | N/A (uses CLAUDE.md) | Reads AGENTS.md (optional) | Primary instruction file | N/A | Yes (directory-scoped) | No |

---

## Universal Spec Mapping

Key fields any universal spec must represent:

```
identity:
  name: string                  # Tool/agent identifier
  description: string           # When to invoke / purpose
  role: string                  # System prompt / persona

instructions:
  global: path[]                # User-level instruction files
  project: path[]               # Project-level instruction files
  mode_specific: {slug: path[]} # Mode/agent-specific overrides
  scope_strategy: enum          # merged|override|precedence

tools/permissions:
  allow: pattern[]              # Permitted tools or operations
  deny: pattern[]               # Blocked tools or operations
  sandbox: enum                 # Isolation level

mcp:
  servers: {name: ServerConfig} # MCP server definitions
  transport: enum               # stdio|http|sse

models:
  primary: ModelRef             # Main model
  per_role: {role: ModelRef}    # Role-specific models (chat, embed, etc.)

activation:                     # For rule/instruction files
  always: bool
  glob: string[]
  auto_description: string
  manual: bool

persistence:
  scope: enum                   # user|project|local
  path: string                  # Memory directory

hooks:
  events: {event: HookConfig[]} # Lifecycle hooks
```

---

## Unresolved Questions

1. **Cursor max rule file size** — not documented; need empirical testing or GitHub issue search.
2. **Codex CLI `[agents]` section full schema** — only `max_threads` confirmed; role config format undocumented in public refs.
3. **Roo Code global `mcp_settings.json` exact path** — described as "Roo Code extension's global settings directory" but actual OS path not documented publicly.
4. **Windsurf `.windsurfrules`** — referenced in community GitHub issues but not in official docs; may be legacy or removed.
5. **Continue `config.ts` API surface** — programmatic config allows arbitrary TypeScript; no formal schema.
6. **Windsurf hooks format** — `cascade/hooks.md` referenced but not fetched; format unknown.
7. **Codex CLI multi-agent config** — `[agents]` section referenced but full spec not in public docs as of Mar 2026.
