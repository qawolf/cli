---
"@qawolf/cli": patch
---

Record video, HAR, and trace artifacts for browser contexts that flows create themselves via `browser.newContext()` — previously only the context `launch()` returned was recorded, so flows using helpers that build their own context produced empty artifacts. Each context now writes to its own file (`<flow>.har`, `<flow>-2.har`, …).
