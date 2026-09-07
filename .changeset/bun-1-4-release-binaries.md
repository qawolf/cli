---
"@qawolf/cli": patch
---

Built with Bun 1.4.2 instead of 1.3.13. The standalone `qawolf` binary starts about 2.5x faster (492 ms to 188 ms for `qawolf --version` on a laptop). The npm bundle is produced by the same bundler version and is meant to behave exactly as before.
