# Log: corpus-heldout

- Heldout folder did not exist. Built 10 cases from MIT sources (TanStack table, react-hook-form, TodoMVC, excalidraw, Redux).
- Upstream files need uninstalled libraries, so each case is a rewrite in the source's shape. Recorded in `meta.json` `adaptation`.
- vitest rejects `--set`. Added `src/test.ts` wrapper and `test/heldout.test.ts`.
- React and Preact differ on `checked`, `value`, empty `class` and attribute order. The heldout test normalizes them.
- Checks pass. See `outcome.md`.
- Review round: replaced `paginator`, `row_select` and `column_toggle` with `hue_slider`, `hex_input` (react-colorful, MIT) and `otp_input` (react-otp-input, MIT), all `derived: false`.
- Added `derived` to every `meta.json`. Restricted the `checked` and `value` normalization to `input` and `textarea`. `form_validation` options lost their `value` attribute for that reason.
- `src/test.ts` accepts `--set=a,b`.
- The harness container is detached from `document`. New scenarios query through a ref on a wrapper div.
