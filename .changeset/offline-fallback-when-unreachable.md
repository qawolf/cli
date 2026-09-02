---
"@qawolf/cli": minor
---

`flows run --env` can now run from the pulled copy when the platform is not reachable. The fallback applies only when the platform did not answer — a connection failure or a timeout. An answer from the platform, for example an unknown environment or a rejected key, stops the run and shows that answer.

A pulled environment resolves by its id, its slug, or its display name — every form the CLI can show.
