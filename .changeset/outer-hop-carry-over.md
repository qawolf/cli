---
"@qawolf/cli": patch
---

`qawolf flows run` no longer drops packages that sit in the project's `node_modules` without being declared in `package.json`. The runner reuses the whole `node_modules` when it holds every declared dependency. When one declared dependency is missing, the runner installs the declared set into the run directory instead. That install carried only the declared packages. An undeclared import therefore stopped resolving because of an unrelated missing package. The install now also links the remaining packages from the project's `node_modules`.

The run reports what happened. It warns which `node_modules` it did not reuse, what that directory is missing, and which undeclared packages it carried over. In `--json` mode, a failure from an unresolved package now carries the same hint that human and agent runs already printed.
