---
"@qawolf/cli": patch
---

Fix `ERR_MODULE_NOT_FOUND` for correctly declared flow dependencies: dependency
discovery now validates an ancestor `node_modules` before reusing it, and falls
back to installing the project's declared deps when none satisfies them
(reported as `Installing N project dependencies…`).
