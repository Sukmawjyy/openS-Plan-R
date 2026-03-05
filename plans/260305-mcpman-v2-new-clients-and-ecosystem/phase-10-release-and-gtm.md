---
phase: 10
title: v2.0 Release & Go-to-Market
status: completed
priority: high
estimatedEffort: 1 week
completedDate: 2026-03-05
blockedBy: [phase-01, phase-02, phase-03, phase-04, phase-05, phase-06, phase-07, phase-08, phase-09]
blocks: []
---

# Phase 10: v2.0 Release & Go-to-Market

## Overview

Final release preparation, migration guide, website update, and launch campaign.

## Checklist

### Pre-Release
- [ ] All tests passing (target: 700+)
- [ ] Lint clean
- [ ] No security vulnerabilities in deps
- [ ] Migration guide v1.x → v2.0
- [ ] CHANGELOG.md updated
- [ ] README.md rewritten for v2.0
- [ ] Website updated (mcpman.pages.dev)

### Release
- [ ] `npm publish mcpman@2.0.0`
- [ ] GitHub release with changelog
- [ ] Tag v2.0.0

### Go-to-Market (Launch Day)
- [ ] GitHub release announcement
- [ ] Hacker News post (Tuesday-Thursday, 10am ET)
- [ ] Reddit r/programming, r/artificial, r/LocalLLaMA
- [ ] Twitter/X thread
- [ ] dev.to article
- [ ] Product Hunt submission

### Week 1 Post-Launch
- [ ] Respond to all HN/Reddit comments < 1h
- [ ] Fix critical bugs from user reports
- [ ] Reach out to YouTube content creators
- [ ] Discord server setup

### Month 1 Targets
- [ ] 500-1K GitHub stars
- [ ] 20+ issues (engagement signal)
- [ ] 5-10 contributors
- [ ] 1K+ npm downloads/week
- [ ] GitHub Sponsors page live

## Migration Guide (v1.x → v2.0)

### Breaking Changes
1. `ClientType` union expanded — TypeScript consumers need update
2. `ServerEntry` interface expanded with `type`, `url`, `headers` fields
3. New dependencies: `@iarna/toml`, `yaml`, `@modelcontextprotocol/sdk`
4. New commands: `skill`, `agent`, `team`, `serve`, `dashboard`, `publish`
5. Lockfile schema v2 — auto-migrated on first run

### Migration Steps
```bash
# Upgrade
npm install -g mcpman@2.0.0

# Lockfile auto-migrates
mcpman doctor  # Verifies everything works

# No action needed for existing MCP server configs
# All v1.x commands work unchanged
```

## Website Updates

- Feature comparison table (v1.0 vs v2.0)
- 10 clients showcase
- MCP server mode documentation
- Skills & agents documentation
- Registry integration guide
- Team collaboration guide
- Dashboard screenshots
