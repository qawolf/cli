---
"@qawolf/cli": patch
---

A 404 on a trigger, issue, flow, agent session or file now names that record and the id it was asked for — `QA Wolf has no trigger trg-1 (HTTP 404).` It used to name the endpoint instead, which read as though the endpoint itself were gone. A request with no such id to name says it matched nothing, rather than that it could not be found.
