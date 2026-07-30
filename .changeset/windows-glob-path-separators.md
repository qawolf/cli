---
"@qawolf/cli": patch
---

Stage flow files correctly on Windows. Flow discovery returned forward-slash paths from the glob, while the rest of the CLI builds paths with `node:path` and gets backslashes. The staging step compared the two, never matched, and returned the original source path. `qawolf flows run` then executed flows from the project tree instead of the prepared run directory, so a flow resolved whatever Playwright the project had installed rather than the pinned executor, and a flow importing `#playwright` failed. Flow discovery now returns one canonical path form.
