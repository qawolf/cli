---
"@qawolf/cli": minor
---

Adds `qawolf build upload <file>`. It uploads an `.apk`, `.aab` or `.ipa` and creates a build from it in one step: it requests an upload URL, PUTs the file, then calls `build create`. `--environment-id` or `--environment-name` puts the build on an environment, so that environment's runs install it. `--branch` and `--commit-sha` record where it came from.
