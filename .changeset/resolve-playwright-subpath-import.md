---
"@qawolf/cli": patch
---

Resolve the `#playwright` subpath import when running flows in the isolated managed runtime. QA Wolf flow bundles import Playwright through a Node.js `imports` alias (`#playwright`), but the pulled bundle's `package.json` omits the `imports` field, so the staged `exec/package.json` could not resolve it and flows failed with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. The CLI now merges the `#playwright` alias into the staged `exec/package.json`, pointing it at the pinned Playwright resolved through the inner-hop `node_modules` symlink — fixing both the Node import path and the compiled-binary bundle path.
