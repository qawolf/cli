---
"@qawolf/cli": minor
---

`qawolf flows pull` now records environment variable names found by static analysis of each flow. It follows module initialization and reachable calls, including literal names passed through helpers such as `requireEnv("NAME")`. Dormant function bodies and unused methods do not add reads merely because their module was imported.

The pull result warns about variables the flows read that the environment does not set, grouping them by name and reporting how many flows read each one. Reads may be optional. Runtime and operating-system settings are excluded from these warnings.

Dynamic keys and unresolved local calls can hide additional reads. Affected flows are counted in the pull result and marked with `envVarsMayBeIncomplete` in the manifest. Recorded names are a static approximation, not a complete list of required variables, and local edits do not refresh them. Older manifests leave the analysis fields absent until the next pull.
