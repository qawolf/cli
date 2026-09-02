---
"@qawolf/cli": minor
---

`flows run --tag` and `flows list` now handle flows from more than one pulled environment. When a tag matches flows in several environments, an interactive run asks which environment to use, and `--all-envs` runs every match. The CLI warns when `--all-envs` has no effect: with `--env`, or without `--tag`.

`flows list` shows the environment of each flow, and `flows list --env` filters to one pulled environment without a platform call. An unknown `--env` value lists the environments that are on disk.
