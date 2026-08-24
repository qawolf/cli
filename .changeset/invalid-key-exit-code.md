---
"@qawolf/cli": patch
---

Exit with code 3 when the API rejects the key with HTTP 401.

Before this change, a command that sent an invalid `QAWOLF_API_KEY` exited with code 1, which the documented contract reserves for flow failures. Only a missing key exited with code 3. Now the public API commands and `qawolf auth whoami` exit with code 3 for a missing key and for an invalid key. A CI wrapper that branches on the exit status can now tell an auth failure from a test failure.
