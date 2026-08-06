---
"@qawolf/cli": patch
---

Clearer public API errors. A 404 now names the resource, the id, and the flag you actually passed (e.g. `No issue found with id "…". Check the --issue-id value.`) instead of a hardcoded template that pointed everyone at a non-existent `--env` flag. Server-side 400s and ambiguous 404s now surface the platform's own explanation (e.g. `A tag named "…" already exists for this team.`) instead of a bare `request failed (HTTP 400)`.
