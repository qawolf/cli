---
"@qawolf/cli": patch
---

Teach the shipped `qawolf-cli` skill the runner group, written for a harness that has a shell, an API key and its own vision model and none of QA Wolf's tooling.

The new section covers getting a runner (ids are yours, relaunching one attaches rather than billing twice) and the sharp edges worth stating rather than discovering: a runner launched for you has a fresh browser with nothing signed in and no page open; a freshly launched runner has no screen until something runs on it, so an early `screen-not-ready` or an empty recorder read is not a fault; the recorder carries the locators and alternates a screenshot cannot give you; a run answers with an id while its outcome lives in the `run-status` stream; and an unreachable answer from `qawolf runner run` does not mean the run did not start, so resubmitting bills a second one. Auth, output and the reads-versus-writes framing now account for the group as well.
