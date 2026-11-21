# Roadmap: compiler-rewrite

This folder is a parallel roadmap. `GOAL.md` has the outcome. Each node is a folder under `nodes/`. The design and its reasons are in `debate/debate.md`.

Rules for agents working on a node:

- Work only on your own node. Edit files inside your brief's owned paths and your own `nodes/<id>/` folder.
- Do not edit other briefs, `status` fields, contracts or `GOAL.md`. The orchestrator owns them.
- If a contract is wrong, write `contracts/<name>.change-request.md` and adapt locally. Do not edit the contract.
- Keep notes in your `log.md`. Finish by writing `outcome.md` from the template.
- Read the outcomes of your direct dependencies. Do not read other nodes' logs.
- Never open `benchmarks/corpus/heldout/`, unless your node is `corpus-heldout` or `final-gate`. Those files measure the result and must not tune it.
- Do not read React Compiler's source code. Run it only through the harness in `benchmarks/compare/`.
- Load the agent-skills `ts-style` and `plain-writing` skills before writing code or prose.

Script: `python3 <parallel-roadmap skill>/scripts/plan.py docs/roadmaps/compiler-rewrite context <id>` lists the files to load for a node.
