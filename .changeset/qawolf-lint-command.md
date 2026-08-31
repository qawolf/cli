---
"@qawolf/cli": minor
---

Add `qawolf flows lint [pattern]` to lint flow files with QA Wolf's rules, honoring the repo's `.eslintrc.json`. It lints every flow when the pattern is omitted, exits 1 when a flow has a lint error, and 0 when every flow is clean or only has warnings.
