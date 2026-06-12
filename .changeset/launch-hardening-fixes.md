---
"@qawolf/cli": patch
---

Harden tar extraction in `flows pull` to reject archive entries with an unknown size, and restore flow-discovery and runner logging in `flows run --env` mode.
