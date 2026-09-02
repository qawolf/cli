---
"@qawolf/cli": minor
---

`flows list` now shows the tags of each flow.

`flows pull` gets the tags of an environment and writes them to the manifest. A failed tag request does not stop the pull, and it does not erase tags from an earlier pull.

Local `flows list` no longer sends `tags: []` for a flow it did not pull. The `tags` key is absent when the tags are unknown, and `[]` only when the flow has none.
