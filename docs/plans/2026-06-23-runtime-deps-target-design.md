---
title: Runtime-dependency resolution — target architecture (design)
date: 2026-06-23
branch: wiz-10907-potential-incompatibility-with-other-monorepo-and-single
status: approved-pending-spike
supersedes-investigation: docs/plans/2026-06-23-runtime-deps-architecture-redesign.local.md
tags: [design, runner, runtime-deps, architecture]
---

# Runtime-dependency resolution — target architecture

## Problem

PR #1381 moved the pinned flow runtime deps out of the user's project into an isolated managed
dir to stop monorepo `node_modules` pollution. It fixed pollution but broke running real flows:
a full empirical `/dd-compat` pass returned NOT-YET with three ship-blockers.

The current design merged two concerns that must be separated:

- **(a) Executor / native-runtime resolution** — `@qawolf/flows`, `playwright`,
  `@qawolf/testkit`, `@qawolf/emails`, the appium drivers. CLI-owned, pinned, and must never
  touch the project's `package.json` or `node_modules`.
- **(b) The flow project's own declared deps** — `diff`, `@faker-js/faker`, `axios`, workspace
  packages, etc. These must still resolve.

The design resolves (a) into a managed dir, then via staging + `linkManagedDeps` _replaces_ the
project's `node_modules` with the managed one — dropping (b) entirely. The unifying requirement
is: **executor resolution is independent of, and never pollutes, the surrounding project — but
the flow's own declared dependencies must still resolve.**

### The three ship-blockers (from the empirical verification)

1. **Managed runtime omits the flow's own deps** (both channels; regression). The managed dir
   installs only the 7 pinned pkgs; staging excludes `node_modules` and `linkManagedDeps`
   symlinks only the managed tree. The removed `ensureFlowDeps` (on `main`) used to install the
   full project tree.
2. **Shared runtime dir corrupts across channels.** The dir is keyed on package versions only,
   not channel. The binary writes CJS `Bun.build` shims; the Node channel removes them; whoever
   installs first wins and the other channel breaks.
3. **Binary never runs a web flow end-to-end.** `loadFlowDefault` pre-bundles the flow under the
   compiled binary, inlining a _second_ copy of `@qawolf/flows` whose AsyncLocalStorage instance
   differs from the runner's → `page` undefined.

## Decisions

1. **Flow-deps model → hybrid / layered.** The executor is always CLI-owned and isolated; the
   flow's own deps resolve from the project when present, else are CLI-installed into the run dir.
2. **Binary loading → drop the pre-bundle + shim, gated by an early spike**, with a keep-but-fix
   fallback.

## Core mechanism — layered `node_modules` via filesystem walk-up (fixes Blocker 1)

Node and Bun resolve a bare import by walking `node_modules` up the **importing file's real
directory chain**, and **the deepest (closest) `node_modules` wins**. Compose two independent
roots so the executor is the _closer_ hop — it must win even when the project ships its own copy:

```
<managed>/<versionHash>/node_modules/{@qawolf/flows, playwright, …}        ← EXECUTOR cache (CLI-owned, pinned, shared)
<managed>/<versionHash>/.runs/<runId>/node_modules/{diff, faker, axios}    ← FLOW'S OWN DEPS  (outer hop, per run)
<managed>/<versionHash>/.runs/<runId>/exec/node_modules → ../../node_modules ← EXECUTOR (inner hop — symlink to the cache)
<managed>/<versionHash>/.runs/<runId>/exec/<staged flow tree>             ← the flow files (staged under exec/)
```

The flow is staged under `exec/`, so walk-up hits the executor first:
`import playwright`/`@qawolf/flows` → `exec/node_modules` (executor, **pinned — wins**) → done.
`import diff` → `exec/node_modules` (miss) → `.runs/<runId>/node_modules` (flow's own, hit). Both
resolve; the executor is shared/cached and **cannot be shadowed by a project copy**; the project
is never written.

This replaces today's stage-to-cwd + `linkManagedDeps`-replace path (which dropped the flow's
deps). **Per-run staging relocates under the managed version dir** (`.runs/<projectHash>-<pid>/`,
keeping the per-run pid isolation from commit b22b0807, moved off the user's cwd — a side win:
no `.qawolf/.local` litter in the project).

### Prefer-pinned: the executor never loses to a project copy

The ordering above is load-bearing. If the flow's-own-deps hop were _closer_ than the executor
(the naïve layering), a monorepo that ships its own `playwright` or `@qawolf/flows` would shadow
the pinned executor — the flow would run against the project's version, breaking the
"executor is always CLI-owned/pinned" guarantee (the PR's own `playwright@1.40.0` scenario).
Putting the executor at the **inner** `node_modules` makes prefer-pinned positional and
mechanism-agnostic: it holds whether the flow's deps came from a symlink (case 2) or an install
(cases 1 & 3), so it does not depend on the install-path executor-stripping alone. Executor
internals still resolve from the executor cache (their hoisted transitive deps sit beside them).

### Child `node_modules` population (the hybrid rule)

- **Project has an installed `node_modules`** (case 2, monorepo) → symlink the **outer** hop
  (`.runs/<runId>/node_modules`) to the **nearest ancestor `node_modules`** of the flow. This
  captures hoisted, workspace, and private deps; workspace symlinks resolve onward into the real
  monorepo. Never writes into the project. A project copy of an executor here is harmless — the
  inner `exec/node_modules` hop wins first (prefer-pinned, above).
- **No installed `node_modules`** (cases 1 & 3) → read the flow's `package.json` and
  `npm install` its deps into the outer hop, **stripping the 7 executor packages** (hygiene — the
  inner hop already wins, but no point downloading a redundant executor). This restores the
  deleted `ensureFlowDeps` behavior, relocated off the project. Empty-dir / no `package.json` →
  empty outer hop; the executor still resolves via the inner hop (the minor "Cannot find
  @qawolf/flows" failure disappears).

The layered core is **channel-agnostic and low-risk**: the flow's own deps are plain packages
resolved by ordinary walk-up, and the flow file is **not** inside an `@scope/` dir, so its
first-hop bare imports are not subject to WIZ-10612.

## Binary executor resolution (Blockers 2 & 3) — spike-gated

WIZ-10612 (documented in `src/domains/runtimeEnv/shimDeps.ts:7-27`, current as of pinned
**Bun 1.3.13**) makes the **compiled binary** mis-resolve from inside an `@scope/` package:
`@qawolf/flows` (exports map `.`, `./web`, `./_runner`, …; deps `@qawolf/flow-targets`→`zod`,
`expect`, `pngjs`, …) cannot reach its own bare deps in the outer `node_modules`. That is _why_
the pre-bundle and CJS shims exist — and the pre-bundle inlining a second `@qawolf/flows` copy
is the root of Blocker 3.

**Blocker 3 fix is independent of the spike.** Whatever the binary does, **externalize the
executor packages** (`@qawolf/flows`, `@qawolf/testkit`, `@qawolf/emails`, browser drivers) from
any flow bundle so the flow imports the **same** `@qawolf/flows` instance the runner's
`initFlowRuntime` configured. Today `loadFlowDefault` externalizes only `browserDrivers`.

**Spike (gates the binary branch).** Build the binary on pinned Bun and test whether the
compiled binary resolves, from the layered tree, (i) `@qawolf/flows/web` subpath exports from an
external `node_modules`, (ii) a scoped package's transitive bare imports, and (iii) **a monorepo
that ships a conflicting executor version** (e.g. `playwright@1.40.0` in the outer hop) still
binds the pinned inner-hop executor — confirming positional prefer-pinned holds under the binary
resolver, not just under Node.

- **PASS (WIZ-10612 effectively gone)** → drop the pre-bundle **and** the shim entirely. The
  binary path becomes the Node path (`import()` + walk-up). Channel-keying the hash is
  unnecessary. Blockers 2 & 3 vanish with the machinery.
- **FAIL (bug still bites)** → keep-but-fix:
  - Pre-bundle the flow with **`@qawolf/flows`/testkit/emails/browser-drivers externalized**
    (Bun.build inlines the flow's _own_ deps, resolved from the layered child) → fixes Blocker 3.
  - **Channel-key `managedEnvHash()`** (`node` vs `binary`) so the binary's shims live in a
    separate runtime dir and never corrupt the Node channel → fixes Blocker 2.
  - Keep the executor-dep shim only inside the binary-keyed dir.

Either branch fixes all three blockers; the spike only decides how much binary machinery remains.

## Per-case × channel resolution matrix

All cases bind the executor at the **inner** `exec/node_modules` hop, so the pinned executor wins
over any project copy (prefer-pinned). The flow's own deps resolve at the outer hop.

| Case           | Channel | Executor (a) — inner hop, pinned    | Flow's own deps (b) — outer hop      | Project writes |
| -------------- | ------- | ----------------------------------- | ------------------------------------ | -------------- |
| 1 managed-only | Node    | inner-hop symlink → cache ✓         | npm install flow pkg.json ✓          | none           |
| 1 managed-only | Binary  | spike: inner-hop, else shim ✓       | inlined by Bun.build OR outer hop ✓  | none           |
| 2 monorepo     | Node    | inner-hop, wins over project copy ✓ | outer → symlink nearest project nm ✓ | none           |
| 2 monorepo     | Binary  | spike: inner-hop / shim ✓           | inlined / outer symlink ✓            | none           |
| 3 empty-dir    | Node    | inner-hop symlink → cache ✓         | npm install flow pkg.json ✓          | none           |
| 3 empty-dir    | Binary  | spike: inner-hop / shim ✓           | inlined OR outer hop ✓               | none           |

**Known limitation:** a monorepo that puts deps in a _leaf-local_ `node_modules` under the flow
(not hoisted) layers only the nearest one. Hoisted / workspace layouts (the norm) are fully
covered.

## Observability (table stakes)

The console reporter already prints the cause chain (`createConsoleReporter.formatErrorWithCause`,
lines 57-66, 100-108). Close the real gaps:

- Surface **load-time** failures (`loadFlowDefault` / `initFlowRuntime`, which throw before
  `runner.run` wraps a `FlowRunError`) with their structured cause.
- Add the cause chain to the **JUnit** reporter (currently `err.message` only).
- Audit the **json / markdown** renderers.

## Implementation order (Slice 3)

1. **Spike (gating):** build binary on pinned Bun; test layered-tree resolution of
   `@qawolf/flows/web` exports + scoped transitive imports + a conflicting-executor-version
   monorepo (positional prefer-pinned). Records PASS/FAIL.
2. **Layered resolution core** (channel-agnostic, regardless of spike): stage the flow under
   `<managed>/<versionHash>/.runs/<runId>/exec/` with the **inner** `exec/node_modules` symlinked
   to the executor cache and the **outer** `.runs/<runId>/node_modules` holding the flow's own
   deps (symlink-nearest-project-nm vs install-flow-pkg-deps, executor pkgs stripped). The
   inner-hop ordering is what guarantees prefer-pinned — assert it with a conflicting-version
   test. Rewire `runDefaults.ts` / `hybridRunDefaults.ts`; keep `ensureRuntimeEnv` for the
   executor root only.
3. **Blocker 3 fix:** externalize `@qawolf/flows` / testkit / emails from `loadFlowDefault`'s
   bundler.
4. **Binary branch (spike-driven):** PASS → delete the pre-bundle path, `shimDeps.ts`, and the
   `QAWOLF_COMPILED` bundling fork; FAIL → channel-key `managedEnvHash()` and keep the shim in
   the keyed dir.
5. **Observability:** load-time cause surfacing + JUnit cause + renderer audit.
6. Unit tests for the new resolution model; `lint:fix`, `format`, `typecheck`, `knip` clean.

Likely-touched modules:
`src/domains/runtimeEnv/{ensureRuntimeEnv,managedEnvDir,linkManagedDeps,shimDeps,installPinned}.ts`,
`src/domains/flows/{stageFlows,ensureDeps}.ts`,
`src/domains/runner/{loadFlowDefault,initFlowRuntime}.ts`,
`src/commands/flows/{runDefaults,hybridRunDefaults}.ts`,
`src/shell/reporter/createJUnitReporter.ts`.

## Verification (Slice 4)

Re-run the `/dd-compat` harness: a real flow on BOTH channels in all 3 cases, zero project
pollution, no cross-channel corruption, flow-failure causes visible. Real env to pull:
`ckzese4wg5893850qb6x1r01pd`. Managed dir on this machine:
`~/Library/Application Support/qawolf-nodejs/runtime/`.
