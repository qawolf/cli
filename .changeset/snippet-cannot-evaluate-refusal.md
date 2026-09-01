---
"@qawolf/cli": patch
---

`qawolf runner exec` now tells apart a runner with nothing attached to evaluate a snippet (`runner-cannot-evaluate-snippets`, which will never clear) from one that could not be reached (`runner-unreachable`, which may still be starting or busy) instead of reporting both the same way.

This depends on `@qawolf/api-contracts` publishing the `runner-cannot-evaluate-snippets` failure reason on `runner.evaluateSnippet` (qawolf/platform#32612, ARC-610); it ships once that dependency is bumped in a preceding release.
