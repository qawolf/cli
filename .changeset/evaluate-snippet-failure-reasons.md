---
"@qawolf/cli": patch
---

`qawolf runner exec` now tells apart a runner with nothing attached to evaluate a snippet (`runner-cannot-evaluate-snippets`, exit `2`, which will never clear) from one that could not be reached (`runner-unreachable`, exit `4`, which may still be starting or busy) instead of reporting both the same way. Only the unreachable message warns that the snippet may still be executing, since only that case can have taken effect before its answer was lost.
