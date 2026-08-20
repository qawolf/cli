---
"@qawolf/cli": minor
---

Map nested contract inputs to CLI flags.

A generated command now derives one flag for each leaf of a nested object, for example `--metadata-commit-sha` for `metadata.commitSha`. The command reassembles the flag values into the nested input before it validates and sends the request.

A union of object branches no longer requires a shared literal discriminator. The command exposes the fields of every branch as optional flags, and local contract validation rejects an invocation that mixes branches.

The command build fails with a clear error when two fields produce the same flag name, or when union branches disagree on the schema of a shared field.
