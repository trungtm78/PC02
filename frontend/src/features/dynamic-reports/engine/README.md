# Dynamic-reports engine (generated)

Everything under `generated/` is copied byte-for-byte from
`backend/src/dynamic-reports/engine/` by `npm run gen:dr-engine` (run from
`backend/`), per design spec §10 R2: the grid needs the exact same
decimal/token/period/expr/aggregate/access/status/paste logic the server
uses, so live formula recompute and client-side validation never disagree
with what the server will eventually accept or reject.

**Never hand-edit anything in `generated/`.** Edit the backend source
instead, then re-run `npm run gen:dr-engine` and commit both sides. Two
jest gates in the backend
(`backend/src/dynamic-reports/engine/gen-dr-engine.gate.spec.ts`) enforce
this: byte-equality between the backend source and this copy, and that no
engine file imports `@nestjs/*`, `@prisma/*`, or a Node-only module.
