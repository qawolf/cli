---
"@qawolf/cli": patch
---

Change the default `flows run` output directory from `qawolf-output` to `.qawolf/output`, so run artifacts (videos, traces, HAR) land under the `.qawolf/` directory that `qawolf init` gitignores. Pass `--output-dir` to override.
