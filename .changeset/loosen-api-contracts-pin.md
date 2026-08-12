---
"@qawolf/cli": patch
---

Accept any `@qawolf/api-contracts` 0.x version at or above 0.24.0 instead of an exact pin. The exact pin forced registries to carry that one version and broke consumers that bundle the CLI next to a newer workspace copy of the contracts.
