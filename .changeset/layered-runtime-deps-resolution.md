---
"@qawolf/cli": minor
---

Resolve flow runtime dependencies through a layered, project-isolated `node_modules` so flows run correctly in monorepos, single-package projects, and empty directories across both the Node and compiled-binary channels. The CLI-owned executor is always pinned and never pollutes or is shadowed by the surrounding project, while the flow's own declared dependencies still resolve. Adds `qawolf install clear` to wipe the managed runtime cache.
