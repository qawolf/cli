---
"@qawolf/cli": patch
---

Generated commands can now take a top-level input that holds objects and can't be split into flags as one `--<name> <json>` flag, instead of failing to build. The flag also takes `@<path>` to read the JSON from a file, or `-` to read it from stdin. The value is checked against the command's input before anything is sent. No command has such an input with `@qawolf/api-contracts` 0.116.0, so no command's flags change in this release.
