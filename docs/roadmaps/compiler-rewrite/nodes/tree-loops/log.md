# Log: tree-loops

- Plan shape: new nodes come from a site walk over each node's own territory (node range minus child ranges, never inside closures). Sites are loops and `.map(fn)` calls. The walk recurses into new iteration nodes, so nested sites are found.
- Body blocks reuse `GroupPlanner`. Candidates: return and const statements, `name = <jsx />`, and elements passed to a call (`rows.push(<Row />)`).
- Loop counters (`for (let i...)`, for-of and for-in names) are not plain inputs because the header writes them. Added `Context.perIteration` in `baseline.ts` and one early return in `isPlainInput`. A counter written in the body is not marked.
- `.map` keep block: `at` is the call range, so emit lowers an enclosing arm and the call runs only when the arm does. A block that cached the call alone is dropped. A block that holds the call loses the inputs only the call read and gets the keep output as an input, unless it reads a group member outside the call.
- Dead end: a keep block for the `rows` array of a counter loop. The `<ul>{rows}</ul>` block is refused (written in a loop), and re-planning it needs a changed context. Row elements are already stable, so React skips the rows. Left out.
- Probe compiles must import child components or the unit bails (orchestrator note).
