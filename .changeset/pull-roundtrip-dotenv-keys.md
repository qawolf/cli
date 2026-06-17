---
"@qawolf/cli": patch
---

Round-trip environment variables whose keys are not POSIX shell identifiers (e.g. OTP URIs keyed by email) when running flows locally, instead of failing or dropping them.
