---
"@qawolf/cli": patch
---

`qawolf runner` now passes on the reason QA Wolf gave for refusing a request, instead of only the status code.

Running a file that is not a flow used to answer "runner.runFlow request failed (HTTP 400)" and stop there, while the server had already said which file was wrong and that an entry point has to be a flow file under `src/flows`. That sentence now reaches the caller.
