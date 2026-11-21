---
'forgetti': patch
'rollup-plugin-forgetti': patch
'vite-plugin-forgetti': patch
---

Packages are built with tsdown. Files under `dist/` moved, so deep imports into `dist/` paths need updating. The `exports` entry points are unchanged.
