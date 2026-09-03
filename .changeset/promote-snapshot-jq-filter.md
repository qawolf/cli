---
"@qawolf/cli": patch
---

Name the image-diff run event correctly wherever `promote-snapshot` points at it. Its type is `imageDiffArtifact`, so the documented `jq 'select(.type == "image-diff-artifact")'` filter matched nothing, and the failure message shown when a path is wrong sent readers after an entry name that does not exist — in both cases leaving the two paths the command requires unfindable.
