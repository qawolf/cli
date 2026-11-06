---
"@qawolf/cli": minor
---

`qawolf trigger create` and `qawolf trigger update` take `--window-start-time` and `--window-end-time`, so an hourly schedule runs only between two times of day, such as every hour from 09:30 to 18:00. Every run keeps the start's minute, and `--every` counts from the start. `--every` on an hourly schedule now takes 1 to 12. `qawolf trigger get` and `qawolf trigger find` return the window.

Upgrades `@qawolf/api-contracts` to `0.130.0`, which also changes these commands. `qawolf narratedRecording get` is new: it reads a narrated recording's voiced video, its export status and, once ready, links to the mp4 and its subtitles. `qawolf run create` takes `--resolution-run-mode`, required when `--ai-task-id` names a promotion conflict resolution task. `qawolf runner act scroll` and `qawolf runner actions` accept a scroll with no delta, as a scroll of 0 both ways.
