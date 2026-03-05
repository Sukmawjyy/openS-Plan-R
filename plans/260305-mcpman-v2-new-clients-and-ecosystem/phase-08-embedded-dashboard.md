---
phase: 8
title: Embedded Dashboard
status: completed
priority: medium
estimatedEffort: 3 weeks
completedDate: 2026-03-05
blockedBy: [phase-01, phase-03]
blocks: [phase-10]
---

# Phase 8: Embedded Dashboard

## Overview

Web dashboard embedded in CLI. `mcpman dashboard` serves static UI at localhost. Vite + React + TanStack Router. Shows server list, health status, config diffs, real-time logs.

## Architecture

```
dashboard/
├── src/
│   ├── main.tsx
│   ├── routes/
│   │   ├── index.tsx          # Server list + status
│   │   ├── servers.$name.tsx  # Server detail
│   │   ├── config.tsx         # Config diff viewer
│   │   ├── audit.tsx          # Security audit results
│   │   └── logs.tsx           # Real-time log streaming
│   ├── components/
│   │   ├── server-card.tsx
│   │   ├── health-badge.tsx
│   │   ├── config-diff.tsx
│   │   └── log-viewer.tsx
│   └── api/
│       └── client.ts          # Fetch from localhost API
├── package.json
├── vite.config.ts
└── tsconfig.json

src/commands/
├── dashboard.ts               # NEW — serve dashboard + API

src/core/
├── dashboard-api.ts           # NEW — local HTTP API for dashboard
```

### API Endpoints (localhost)

```
GET  /api/servers        — List servers with status
GET  /api/servers/:name  — Server detail
GET  /api/clients        — List clients with status
GET  /api/audit          — Latest audit results
GET  /api/diff           — Config diff
WS   /api/logs/:name     — WebSocket log stream
```

### Build Strategy

- Dashboard built at npm publish time → static files in `dist/dashboard/`
- `mcpman dashboard` serves files via `node:http` — zero external deps
- API runs alongside static server on same port

## Implementation Steps

1. Create dashboard/ directory with Vite + React scaffold
2. Build server list page with status indicators
3. Build server detail page
4. Build config diff viewer
5. Build audit results viewer
6. Build real-time log viewer (WebSocket)
7. Create dashboard-api.ts — local HTTP server
8. Create dashboard.ts command
9. Build pipeline: dashboard → dist/dashboard/
10. Write tests

## Todo List

- [ ] Dashboard scaffold (Vite + React)
- [ ] Server list page
- [ ] Server detail page
- [ ] Config diff viewer
- [ ] Audit results viewer
- [ ] Log viewer (WebSocket)
- [ ] Dashboard API (localhost)
- [ ] Dashboard CLI command
- [ ] Build pipeline
- [ ] Write tests (target: 660+ total)
