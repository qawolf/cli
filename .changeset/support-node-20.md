---
"@qawolf/cli": minor
---

Support Node 20. The `engines.node` floor is lowered to `>=20.19.0`, and on Node
versions without native TypeScript support (Node 20, and Node 22.15–22.17) flows
are now loaded through the `@oxc-node/core` ESM loader, which transpiles and
resolves TypeScript at runtime. Bun and Node 22.18+ are unaffected. A CI matrix
smoke-tests the published bundle on Node 20, 22, 24, and Bun.

Note: the `@qawolf/*` platform packages currently declare `engines.node >=22.22.0`,
so installing on Node 20 prints `EBADENGINE` warnings. They are verified to run on
Node 20.19, and the warnings are non-fatal unless `engine-strict` is enabled.
