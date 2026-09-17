---
"@qawolf/cli": patch
---

`qawolf flows run` now resolves the tsconfig path aliases a flow imports through. A flow that imported `@utilities/gpt-helpers.ts` used to fail with `Cannot find package '@utilities/gpt-helpers.ts'`, because the local run handed the alias straight to Node, which went looking for an npm package by that name. The staged copy of your project is now rewritten so every alias becomes the equivalent relative import, which is what the platform runner does before it runs a flow. The aliases come from `compilerOptions.paths` in your project's `tsconfig.json`, the same table and the same rules the platform reads.

Overlapping alias patterns now pick the target TypeScript picks. An exact pattern beats a wildcard, the longest matching prefix wins among wildcards, and the text after the `*` has to match too, so `@utilities/email/*` no longer loses to `@utilities/*` depending on the order the two are written in.

An alias that still does not resolve now says so. The failure used to tell you to declare `@utilities/gpt-helpers.ts` in `package.json` "dependencies" and run npm install, which could never work. It now points at `compilerOptions.paths` in your tsconfig.
