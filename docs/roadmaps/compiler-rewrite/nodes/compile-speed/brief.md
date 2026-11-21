---
id: compile-speed
title: Compile-time pass on oxc
status: todo
priority: could
type: refactor
outline: true
size: M
owns: []
depends_on:
  - on: final-gate
    kind: hard
    why: needs the finished pipeline to profile
---

# Compile-time pass on oxc

## Goal

Profile `compile()` on the full corpus with perf-pass and cut the largest measured cost.
