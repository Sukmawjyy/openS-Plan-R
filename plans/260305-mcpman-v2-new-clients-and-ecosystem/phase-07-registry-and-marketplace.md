---
phase: 7
title: Registry & Marketplace
status: completed
priority: medium
estimatedEffort: 3 weeks
completedDate: 2026-03-05
blockedBy: [phase-01, phase-04, phase-06]
blocks: [phase-10]
---

# Phase 7: Registry & Marketplace

## Overview

Build mcpman's own registry on Cloudflare Workers + D1/R2. Enable `mcpman publish` to share MCP servers and skills. Curated collections, quality scoring, search.

## Architecture

### Backend (Cloudflare Workers)

```
registry/
├── src/
│   ├── index.ts            # Worker entry (Hono framework)
│   ├── routes/
│   │   ├── packages.ts     # CRUD for packages
│   │   ├── search.ts       # Full-text search
│   │   ├── publish.ts      # Package publish endpoint
│   │   └── auth.ts         # GitHub OAuth
│   ├── db/
│   │   ├── schema.sql      # D1 SQLite schema
│   │   └── queries.ts      # Prepared statements
│   └── storage/
│       └── r2.ts           # R2 package storage
├── wrangler.toml           # Worker config
└── package.json
```

### D1 Schema

```sql
CREATE TABLE packages (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT CHECK(type IN ('server', 'skill', 'template')),
  downloads INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 50,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE versions (
  id INTEGER PRIMARY KEY,
  package_id INTEGER REFERENCES packages(id),
  version TEXT NOT NULL,
  tarball_key TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### CLI Commands

```bash
mcpman publish                    # Publish to mcpman registry
mcpman search --registry mcpman   # Search mcpman registry
mcpman install @mcpman/memory     # Install from mcpman registry
```

## Implementation Steps

1. Set up Cloudflare Worker project with Hono
2. Create D1 database schema
3. Implement package CRUD endpoints
4. Implement search with D1 FTS5
5. Implement publish endpoint with R2 storage
6. Add GitHub OAuth for author verification
7. Create `src/commands/publish.ts` — CLI publish flow
8. Update `src/core/registry.ts` — add mcpman registry source
9. Deploy to Cloudflare
10. Write tests

## Todo List

- [ ] Cloudflare Worker project setup
- [ ] D1 schema + migrations
- [ ] Package CRUD API
- [ ] Search API (FTS5)
- [ ] Publish API + R2 storage
- [ ] GitHub OAuth
- [ ] CLI publish command
- [ ] Registry client integration
- [ ] Deploy
- [ ] Write tests (target: 640+ total)
