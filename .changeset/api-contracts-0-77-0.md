---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.77.0`.

`qawolf run listScreenshotComparisons --run-id <id>` lists the screenshot comparisons that failed a run's flows. Each comparison has signed URLs for the expected, actual and diff images, and smaller JPEG previews. `qawolf run acceptScreenshotBaseline` makes the new screenshot of a failed comparison the baseline. `qawolf run restoreScreenshotBaseline` puts back the baseline that an accepted comparison replaced. `qawolf run optOutOfInvestigation` marks failed flows of a run as "do not investigate". `qawolf issue removeFlows` can now remove bug and maintenance report reproductions, and takes `--environment-id` (or `QAWOLF_ENVIRONMENT`) for them. `qawolf run get` shows when a failure was opted out of investigation.
