---
"@qawolf/cli": minor
---

`flows run` and `flows list` accept `--tag <name>` to select only the flows that carry that tag. Give the flag more than one time to select more than one tag.

With `--env`, the CLI reads the tags from the platform. If the platform is not reachable, the CLI uses the tags from the last pull and shows a warning. Without `--env`, the CLI always uses the tags from the last pull.

A tag that matches no flows stops the command with an error. If the tag does not exist on the team, the error names the closest known tag.
