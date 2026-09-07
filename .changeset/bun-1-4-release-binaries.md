---
"@qawolf/cli": patch
---

Release binaries are built with Bun 1.4.2 instead of 1.3.13. The standalone `qawolf` binary starts about 2.5x faster (492 ms to 188 ms for `qawolf --version` on a laptop). Nothing in the CLI itself changes.
