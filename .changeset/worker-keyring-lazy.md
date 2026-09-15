---
"@qawolf/cli": patch
---

The compiled binary runs web flows again. In 1.29.0, every `qawolf flows run` from the binary failed with `Cannot find module '@napi-rs/keyring'`. The worker subprocess that runs a flow loaded the keyring addon at startup, from a directory where it does not exist. The keyring now loads on first use, when a command reads or writes stored credentials, and `@qawolf/flow-targets` ships inside the bundle.
