---
"@qawolf/cli": minor
---

Add `qawolf flows lint [pattern]` to lint source files with QA Wolf's rules, honoring the repo's `.eslintrc.json`. It lints every `.ts` and `.js` file in the project when the pattern is omitted — flows, helpers, and page objects alike, skipping generated output such as `dist/` and `coverage/` — exits 1 when a file has a lint error or could not be read, and 0 when every file is clean or only has warnings.
