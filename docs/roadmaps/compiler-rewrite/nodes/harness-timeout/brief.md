---
id: harness-timeout
title: Time out a hung case in the compare harness
status: todo
priority: should
type: feature
milestone: sound-baseline
size: S
added: 2026-11-22
verify: pnpm --filter compare test
owns:
  - benchmarks/compare/src/**
  - benchmarks/compare/test/timeout.test.ts
depends_on:
  - on: harness
    kind: hard
    why: changes the harness runner that harness built
---

# Time out a hung case in the compare harness

## Goal

A case that never finishes for one compiler and target must count as a difference with a clear message. It must not hang `table`, `gate` or `test`.

## Context

- `corpus-tuning` found that forgetti 0.8 loops forever on a props object that is mutated in place and read as `res.status`. The harness has no timeout, so such a case hangs every command (see `nodes/corpus-tuning/outcome.md`).
- Run each compile-and-render cell with a time limit, in a worker thread or child process that can be killed, since an endless synchronous loop cannot be interrupted in place.

## Acceptance

- [ ] A case whose input loops forever is reported as a difference named `timeout` for the cells that hang, and the command still exits.
- [ ] The limit is set by one constant or flag, default 10 s per cell.
- [ ] `pnpm --filter compare test` passes and takes no more than 20% longer than before.
