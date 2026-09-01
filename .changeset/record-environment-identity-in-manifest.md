---
"@qawolf/cli": patch
---

`flows pull` now records the alias and the display name of an environment in the manifest.

This makes a pulled directory recognisable without the platform. The id stays the source of truth, because an alias can change.
