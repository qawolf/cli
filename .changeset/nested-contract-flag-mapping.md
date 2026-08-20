---
"@qawolf/cli": minor
---

Map nested contract inputs to CLI flags.

A generated command now derives one flag for each leaf of a nested object, for example `--metadata-commit-sha` for `metadata.commitSha`. The command reassembles the flag values into the nested input before it validates and sends the request.

A union of object branches no longer requires a shared literal discriminator. A field that every branch requires stays a required flag. The other fields become optional flags. The contract validates the assembled input locally before the CLI sends a request. Branches that are strict objects reject an invocation that mixes branches.

The command build fails with a clear error when two fields produce the same flag name, or when union branches disagree on the schema of a shared field.
