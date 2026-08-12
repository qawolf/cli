---
"@qawolf/cli": patch
---

Teach the shipped `qawolf-cli` skill the runner group, written for a harness that has a shell, an API key and its own vision model and none of QA Wolf's tooling.

The guide is a skill resource rather than part of the skill body, so it costs nothing until a runner is what the task needs. It leads with what is expensive to discover: relaunching an id attaches rather than billing a second pod; a runner launched for you has a fresh browser with nothing signed in and no page open; only a run starts the screen, so a screenshot before one fails however long you wait; the recorder carries the `locator` and `alternates` a screenshot cannot give you; `exec` returns whether a snippet ran and not its value, so results come back through the `console` stream; and an unreachable answer from `qawolf runner run` does not mean the run did not start, so resubmitting bills a second one. Auth and the reads-versus-writes framing account for the group as well.
