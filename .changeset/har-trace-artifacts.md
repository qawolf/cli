---
"@qawolf/cli": patch
---

Save HAR and trace artifacts reliably from `flows run`. HAR (and video) could be silently dropped because contexts and browsers were closed concurrently, racing Playwright's artifact flush; contexts now close first. The `--trace` flag is now wired end-to-end and writes a Playwright trace to `<output-dir>/trace/<flow>.zip`, honoring `on`, `off`, and `retain-on-failure`.
