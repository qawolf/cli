---
"@qawolf/cli": minor
---

`qawolf runner screenshot --out -` writes the JPEG bytes to stdout instead of a file, so a caller that is a process reads the image off the pipe rather than reserving a temp file, running the command, reading it back and deleting it. Stdout carries the image alone: the confirmation, and the JSON line under `--json`, goes to stderr.
