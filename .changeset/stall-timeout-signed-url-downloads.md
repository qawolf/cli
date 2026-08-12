---
"@qawolf/cli": patch
---

Let large signed-URL downloads finish on slow links. Before this change, flow-bundle and team-storage asset downloads had a fixed 30-second deadline for the full download. A large asset, for example a video file, could not finish in time and `flows pull` failed with a timeout. The 30-second window is now a stall timeout. The timer resets each time data arrives, so a slow download that makes progress can run to completion. A download that receives no data for 30 seconds still fails, and the error message now says the download stalled.
