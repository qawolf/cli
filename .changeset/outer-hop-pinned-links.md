---
"@qawolf/cli": patch
---

Fix `ERR_MODULE_NOT_FOUND: Cannot find package '@qawolf/flows'` when a project dependency (such as `@qawolf/pom`) peer-depends on a pinned runtime package. The per-run install skips peer dependencies (`--legacy-peer-deps`) and the pinned packages were only resolvable from staged flow files, not from installed project dependencies. The outer hop now links every pinned package alongside the installed dependencies, so project packages resolve the same pinned instance the executor uses. Also bumps the pinned `@qawolf/flows` to 0.1.4 and pins its new peer `expect-webdriverio`.
