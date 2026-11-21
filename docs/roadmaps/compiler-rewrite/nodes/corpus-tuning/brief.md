---
id: corpus-tuning
title: Tuning corpus: alias, hooks, Suspense and throw cases
status: todo
priority: must
type: feature
milestone: sound-baseline
size: M
verify: pnpm --filter compare test --set tuning
owns:
  - benchmarks/corpus/tuning/**
depends_on:
  - on: harness
    kind: hard
    why: the acceptance self-check runs in the finished harness
---

# Tuning corpus: alias, hooks, Suspense and throw cases

## Goal

Add the cases the debate found missing, so the gates can see alias, hook and render-discard bugs.

## Context

- Alias and mutation (debate P8): `const x = arr; x.push`; fresh value stored in a field then mutated; a closure that mutates a fresh array and is called in a loop; spread copy then mutate the copy; fresh value passed to an unknown function; mutation inside one branch only; an unknown call feeding a child (debate O12).
- Hooks (debate P10): custom hook returning an object; nested custom hooks; `use()` in a condition; `useEffectEvent`.
- Render discard (debate T1): interrupted transition; Suspense on mount; Suspense on update; StrictMode.
- Throw and retry (debate P17): a call slot, a grouped slot and a per-row cache whose computation throws once; an error boundary swap that keeps the ref.

## Acceptance

- [ ] At least 19 cases in `benchmarks/corpus/tuning/`, each with scenarios, in `corpus-format`.
- [ ] Uncompiled output gives 0 differences on React and Preact (harness self-check).
- [ ] Each case's `meta.json` says what it tests in one line.

## Sizing

M: about 19 small files plus scenarios.
