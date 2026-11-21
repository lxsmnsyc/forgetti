---
id: keyed-iterations
title: Keyed iteration caches
status: todo
priority: later
type: feature
outline: true
size: M
owns: []
depends_on:
  - on: tree-loops
    kind: hard
    why: only if positional caches fail a measured row
---

# Keyed iteration caches

## Goal

Key iteration caches by JSX `key` or item identity, only if `tree-loops` or `final-gate` shows positional caches fail a measured row (debate A2, O7).
