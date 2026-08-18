---
"@qawolf/cli": patch
---

The CLI no longer finds flow files in `node_modules`.

The default pattern is `**/*.flow.{ts,js}`. Some packages use `.flow.js` for a different purpose, because it is also the file name convention of the Facebook Flow type checker. The CLI read these files and showed them as flows. `qawolf flows list` showed a flow for each one. The name came from the file name, because the file has no `flow()` call.

The CLI now ignores `node_modules` when it looks for flow files. The search is also much faster, because a dependency tree contains most of the files in a project.

This does not change how a flow finds a package. A flow that imports a package continues to work.
