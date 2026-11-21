---
id: release
title: Release the new compiler
status: todo
priority: must
type: release
milestone: release
gate: true
size: S
owns: []
depends_on:
  - on: switch
    kind: hard
    why: the release ships the switched package
  - on: docs
    kind: hard
    why: docs ship with the release
---

# Release the new compiler

## Goal

Merge the changesets version pull request and confirm the publish from CI with provenance.

## Acceptance

- [ ] `npm view forgetti@<version> dist.attestations` shows provenance.
- [ ] Both plugins are published at the same version (fixed group).
