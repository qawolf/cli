---
"@qawolf/cli": patch
---

Fix the `promote-snapshot` example's journal filter. The image-diff run event's type is `imageDiffArtifact`, so the documented `jq 'select(.type == "image-diff-artifact")'` matched nothing and left the two paths it is meant to surface unfindable.
