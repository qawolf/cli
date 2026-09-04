# @qawolf/cli

## 1.22.1

### Patch Changes

- 24bde4f: Upgrades `@qawolf/api-contracts` to `0.39.0`.

  That release adds the `authConfigResponse` schema, which gives the WorkOS client id that a client must send to start a device authorization grant. No command changes: the CLI does not read the schema yet, and the release adds no endpoint contracts for the generated public-API commands.

## 1.22.0

### Minor Changes

- 3b259c8: `qawolf run create` forwards `QAWOLF_CHAT_SESSION_ID` as `chatSessionId`, so a run started from a chat session reports its result back into that chat. Pins `@qawolf/api-contracts` 0.38.0.

  The contract rejects `aiTaskId` and `chatSessionId` together, and an AI task pod that holds a conversation exports both variables, so the CLI sends one: an explicit flag beats an ambient variable, and when both are ambient the task id wins, which is the id such a pod sends today.

## 1.21.0

### Minor Changes

- a13c3bb: `qawolf flows list --remote` accepts `--ai-task-id`, listing the flows on that AI task's branch — drafts included — instead of the ones the environment holds at its latest reconciled commit. It defaults to `QAWOLF_AI_TASK_ID`, which an AI task runner already sets, so the flag is only needed to point at another task.
- 7d73a85: Add `@qawolf/cli/runner-sdk`, a typed library for driving interactive runners in process rather than by spawning `qawolf runner`. Every verb names the runner it addresses, so nothing is launched or billed implicitly, and answers come back as the `@qawolf/api-contracts` output types rather than parsed stdout.

### Patch Changes

- 5444be5: `qawolf runner exec` now tells apart a runner with nothing attached to evaluate a snippet (`runner-cannot-evaluate-snippets`, exit `2`, which will never clear) from one that could not be reached (`runner-unreachable`, exit `4`, which may still be starting or busy) instead of reporting both the same way. Only the unreachable message warns that the snippet may still be executing, since only that case can have taken effect before its answer was lost.
- e6971f2: Name the image-diff run event correctly wherever `promote-snapshot` points at it. Its type is `imageDiffArtifact`, so the documented `jq 'select(.type == "image-diff-artifact")'` filter matched nothing, and the failure message shown when a path is wrong sent readers after an entry name that does not exist — in both cases leaving the two paths the command requires unfindable.

## 1.20.1

### Patch Changes

- c0c1fe5: Point the `qawolf-cli` skill's reference files at absolute raw URLs, so a harness that loads `SKILL.md` without its surrounding directory can still reach `references/runner.md` and `references/run-results.md`.

## 1.20.0

### Minor Changes

- 0dbf27d: `flows list` now shows the tags of each flow.

  `flows pull` gets the tags of an environment and writes them to the manifest. A failed tag request does not stop the pull, and it does not erase tags from an earlier pull.

  Local `flows list` no longer sends `tags: []` for a flow it did not pull. The `tags` key is absent when the tags are unknown, and `[]` only when the flow has none.

- 33ebe2f: `flows run --env` can now run from the pulled copy when the platform is not reachable. The fallback applies only when the platform did not answer — a connection failure or a timeout. An answer from the platform, for example an unknown environment or a rejected key, stops the run and shows that answer.

  A pulled environment resolves by its id, its slug, or its display name — every form the CLI can show.

- 8f5d2cf: `flows run --tag` and `flows list` now handle flows from more than one pulled environment. When a tag matches flows in several environments, an interactive run asks which environment to use, and `--all-envs` runs every match. The CLI warns when `--all-envs` has no effect: with `--env`, or without `--tag`.

  `flows list` shows the environment of each flow, and `flows list --env` filters to one pulled environment without a platform call. An unknown `--env` value lists the environments that are on disk.

- 337a4cc: `flows run` and `flows list` accept `--tag <name>` to select only the flows that carry that tag. Give the flag more than one time to select more than one tag.

  With `--env`, the CLI reads the tags from the platform. If the platform is not reachable, the CLI uses the tags from the last pull and shows a warning. Without `--env`, the CLI always uses the tags from the last pull.

  A tag that matches no flows stops the command with an error. If the tag does not exist on the team, the error names the closest known tag.

### Patch Changes

- 1776b65: `flows pull` now records the alias and the display name of an environment in the manifest.

  This makes a pulled directory recognisable without the platform. The id stays the source of truth, because an alias can change.

## 1.19.2

### Patch Changes

- c98d2db: The `QAWOLF_RUNNER_ID` shadow warning added in the previous release no longer suggests `export QAWOLF_RUNNER_ID=<launchedId>` as a fix, since that repoints every other runner-less command too rather than just the one you meant; `--runner <launchedId>` is the only fix it now names. `references/runner.md` documents the new warning alongside the resolution order it stems from.

## 1.19.1

### Patch Changes

- 81212ec: `qawolf runner launch` now warns when `QAWOLF_RUNNER_ID` is set to a different runner than the one just launched, since that variable outranks the directory default and would otherwise send runner-less commands to the stale runner without any indication why.

## 1.19.0

### Minor Changes

- c96c7cf: Add `qawolf runner inspect session|contexts|page-source|elements`, mobile-only arms alongside the existing browser ones, for a runner's Appium session status, its WebView contexts, the current context's page source, or elements at a point or carrying some text.

  `qawolf runner act` now answers `action-not-supported-on-mobile` for an action with no touchscreen equivalent (`double_click`, `scroll`, `move`, `keypress`, `navigate`, or a `click` whose `--button` is not `left`) instead of failing some other way.

  This depends on `@qawolf/api-contracts` publishing the `runner.inspectMobile` contract and mobile dispatch added for ARC-556; it ships once that dependency is bumped in a preceding release.

## 1.18.0

### Minor Changes

- b19e8b6: `flows list --remote --json` now includes each flow's `url`, the flow page on the platform. The agent skill explains that a flow gets a platform page only once it is on the environment's flow code branch and how to land it there.
- 87dbe54: `qawolf runner list` names the runners a directory holds that are still running, and marks the one a command with no `--runner` would reach. Every runner is looked up before it is listed, so one that idled out is absent rather than reported, and the lookup neither starts a runner nor resets an inactivity clock.

## 1.17.1

### Patch Changes

- ff34821: `qawolf runner run` now falls back to `QAWOLF_ENVIRONMENT` when neither `--env-id` nor `--env-file` is passed, so the one export that already sets a default for `qawolf flows` covers a runner run too. `--env-id` still wins over it, and `--env-file` suppresses it so a run reading a dotenv file is not handed a second environment on top.

  The run reports on stderr which environment it picked up. A run that was given none before is now given one, and those variables reach the flow's code, so it should never happen silently.

## 1.17.0

### Minor Changes

- 1ae524c: An environment variable a run sends with `--env-file` may now be up to 16 KiB, up from 8 KiB. The CLI checks the cap locally before any round trip, so it refused at 8 KiB whatever the platform accepted.

  Upgrades `@qawolf/api-contracts` to `0.34.0`, which carries the raised cap and the `environmentId` field `--env-id` sends.

- 1ae524c: `qawolf runner highlight-selector [selector]` draws on a runner's live page so the next screenshot shows what a selector matches. Omit the selector to clear it. A selector the page read but that matched nothing exits `0` and reports the count, while one the page could not read at all exits `2`, so a bad locator is told apart from a locator pointing at nothing.

  `qawolf runner promote-snapshot --screenshot <path> --baseline <path>` accepts a run's screenshot as the new baseline for an image diff, on the runner that produced it. Both paths are the ones the diff reported on the `run-events` journal stream.

- 54b5912: `qawolf runner run --env-id <id-or-alias>` gives a run the variables of a QA Wolf environment. QA Wolf reads and decrypts them itself, so the values never leave the server, nothing has to be pulled to disk first, and the caps that bound `--env-file` do not apply to them. That makes it the only way to run a flow whose environment holds something large, such as a session cookie.

  `--env-id` and `--env-file` each give the run its whole environment, so passing both is refused before a runner is addressed rather than one silently winning.

## 1.16.0

### Minor Changes

- 20d56c3: A run may now carry up to 200 environment variables, up from 100. The CLI checks the cap locally before any round trip, so it refused at 100 whatever the platform accepted.

  Upgrades `@qawolf/api-contracts` to `0.32.0`, which also adds two runner failure reasons. `qawolf runner inspect` against a mobile runner now says so instead of reporting an unknown answer, and `qawolf runner act` says what a touchscreen does instead when it cannot perform the action as asked.

### Patch Changes

- b278e7d: `qawolf runner run --lines <lines> --lines-file <path>` no longer fails when the named file has not changed since the last run on that runner.

  Delta shipping withholds a file whose content hash matches what the runner already holds, so an untouched page object was dropped from the payload and the platform refused the run with `A selection must name a file carried in files.` The selection's file now always travels in full, alongside the entry point and `package.json`.

- 7960eb0: Runner calls now wait 90 seconds instead of 60, so the first action on a fresh runner outlives the platform's browser-start wait instead of timing out client-side.

## 1.15.0

### Minor Changes

- 2b9fcf6: The new command `qawolf run reattempt` requests new attempts for a run's flows, in the same run. A flow is eligible when its result is failed or canceled, and QA Wolf completed its automatic retries. Omit `--flow-ids` to reattempt all of the eligible flows. A run that is fully investigated does not accept reattempts.

  The commands `qawolf environment find`, `qawolf tag list`, and `qawolf tag create` accept a new `--workspace-id` flag. Give the workspace when you authenticate with an organization key or a user key.

  `qawolf run create` now reports the flows that it left out of the run. Each entry in `excludedFlows` gives the flow and the reason: `deleted` if the flow was deleted, or `not-on-branch` if the flow has no file at the commit that the run was created from. Flows that you select with tags are not reported.

## 1.14.0

### Minor Changes

- 6bf56f9: `qawolf flows run` now exits 2 when the pattern selects nothing runnable. It previously exited 0, so a typo'd pattern or a mis-scoped CI shard reported success with no flow executed. Three cases changed: the pattern matches no file, the matched files declare no `target`, and every matched flow has a target the CLI cannot run locally (iOS, Basic, Electron). The `--env` path already exited 2 for its own no-match case.

  Pass `--allow-no-match` to keep the old exit-0 behavior where an empty selection is expected.

### Patch Changes

- b5673eb: Exit with code 3 when the API rejects the key with HTTP 401.

  Before this change, a command that sent an invalid `QAWOLF_API_KEY` exited with code 1, which the documented contract reserves for flow failures. Only a missing key exited with code 3. Now the public API commands and `qawolf auth whoami` exit with code 3 for a missing key and for an invalid key. A CI wrapper that branches on the exit status can now tell an auth failure from a test failure.

## 1.13.0

### Minor Changes

- 2def6d5: Map nested contract inputs to CLI flags.

  A generated command now derives one flag for each leaf of a nested object, for example `--metadata-commit-sha` for `metadata.commitSha`. The command reassembles the flag values into the nested input before it validates and sends the request.

  A union of object branches no longer requires a shared literal discriminator. A field that every branch requires stays a required flag. The other fields become optional flags. The contract validates the assembled input locally before the CLI sends a request. Branches that are strict objects reject an invocation that mixes branches.

  The command build fails with a clear error when two fields produce the same flag name, or when union branches disagree on the schema of a shared field.

- 3dec60a: The `qawolf runner` group speaks `@qawolf/api-contracts` 0.27.0, gains four commands, and ships a run's files by walking the flow's imports instead of reading the whole directory.

  `qawolf runner run` now sends the flow file, everything it imports, and your `package.json` and `tsconfig.json`. Nothing else travels. Before this change it read every runnable file under the working directory, so on a project of a few thousand files it built a payload the platform refused on size and the run never started; you had to run from a directory holding the flow and little else. Imports are followed the way a run from the QA Wolf app follows them, including its limits: relative paths and `tsconfig.json` aliases, resolving `.ts` and `.js`, and not following `export ... from` or `require()`.

  After the first run on a runner, later runs send only the files whose content changed. The baseline lives in `.qawolf/runner-files.json`. A switch to another runner ignores it, a runner that turns out not to hold what was claimed gets the whole set resent, and `--json` reports which happened as `fileSync`.

  `qawolf runner run --lines 12-40` runs those lines against the browser as it stands, so you can iterate on one step without paying for the whole flow to reach it again. `--lines-file` says where the range lives when it is not the flow file, and the positional is now `<flowFile>` in the usage line because two file paths with one unlabelled is easy to get backwards. `--env-file` gives the run environment variables from a dotenv file, in the format `qawolf flows pull` writes.

  `qawolf runner inspect` reads one thing off the live page and prints it on stdout by itself: `element-html --selector`, `page-html`, or `variable --name`, which is a shorter path to a value than printing it from a snippet and reading it back out of the `console` stream. `qawolf runner stop-run` stops what a runner is executing and leaves the runner up. `qawolf runner import-package` installs a package into a live run so a snippet or a selection can import it without a full run to reinstall dependencies.

  Two breaking changes to the `runner` group. `qawolf runner stop` is now `qawolf runner terminate`, which better separates ending a runner from stopping a run on one. And `--name` takes a runner family, `playwright`, `android`, `ios` or `basic`, in place of an image name like `node20WithPlaywright`. Every runner verb also reports a failure as an `outcome` of `failure` with a `failureReason`, in place of one outcome per condition, so `--json` consumers reading `outcome` for a specific condition need to read `failureReason` instead.

### Patch Changes

- 7b9e665: The managed runtime can now load `expect-webdriverio`.

  The runtime installs its packages with `--legacy-peer-deps`, which does not install peer dependencies. `expect-webdriverio` needs `webdriverio`, `@wdio/globals` and `@wdio/logger` as peers, and the runtime had none of them. An import of `expect-webdriverio` stopped with `ERR_MODULE_NOT_FOUND`. The runtime now installs these three packages.

  This does not yet make `expect` available in an Android flow. The runner does not start the mobile `expect`, so a flow that calls `expect` continues to fail. This change removes one of the two causes.

## 1.12.0

### Minor Changes

- 47c7ec9: The managed runtime uses Appium 3.6.0 and the UiAutomator2 driver 8.4.0.

  Appium 2.11.3 installed five copies of `axios` before version 1.15.1. These versions have a header injection defect (CVE-2026-42035). Appium 3.6.0 installs one copy of `axios` 1.18.1.

  `appium` becomes a development dependency. The CLI does not import it. It starts Appium from the managed runtime directory. An install of `@qawolf/cli` is thus smaller: 413 packages in place of 797.

  The managed runtime directory has a new name, so the CLI installs the runtime again when you first run a flow.

- fd89edd: The new command `qawolf issue addFlows` adds flows to a coverage request. Flows that the coverage request already covers stay covered.

  You cannot add flows to a bug report or a maintenance report. These reports link to flows through the runs that reproduce them.

### Patch Changes

- b656edf: The CLI now reads flow names that contain quote characters.

  Before this change, the parser stopped the name at the first single quote or double quote. The parser ignored which quote started the name. Thus the name `Shopper's cart` became `Shopper`. The parser also did not find the target of that flow. A flow without a target does not run. Therefore `qawolf flows run` skipped the flow and showed the message `No flows matched.` The command `qawolf flows list` showed the short name.

  The parser now records the quote that starts the name. It also accepts a backslash before a quote. Thus the parser correctly reads the names `"Say \"hi\""` and `'Shopper\'s cart'`. The parser accepts a name in backticks. A name that contains `${...}` stays dynamic, because the value is only available at run time.

  Two more target forms now work. The CLI reads the target from an options object that contains a second object before the `target` key. The CLI also reads a target in backticks.

## 1.11.2

### Patch Changes

- 50debf1: `npx @qawolf/cli` and `npm install @qawolf/cli` no longer stop responding.

  The CLI pinned `expect-webdriverio` 5.6.5 as a dependency. `@wdio/globals` 9.31.0 then started to require `expect-webdriverio` 6.0.5 or later. npm cannot obey both rules, and it does not report an error. It searches instead, and the install can run for more than 30 minutes.

  `expect-webdriverio` is now a development dependency. The CLI does not import it, so nothing changes when you run a flow.

- f3c38a8: The CLI no longer finds flow files in `node_modules`.

  The default pattern is `**/*.flow.{ts,js}`. Some packages use `.flow.js` for a different purpose, because it is also the file name convention of the Facebook Flow type checker. The CLI read these files and showed them as flows. `qawolf flows list` showed a flow for each one. The name came from the file name, because the file has no `flow()` call.

  The CLI now ignores `node_modules` when it looks for flow files. The search is also much faster, because a dependency tree contains most of the files in a project.

  This does not change how a flow finds a package. A flow that imports a package continues to work.

## 1.11.1

### Patch Changes

- 4eb936c: `qawolf flows run` no longer drops packages that sit in the project's `node_modules` without being declared in `package.json`. The runner reuses the whole `node_modules` when it holds every declared dependency. When one declared dependency is missing, the runner installs the declared set into the run directory instead. That install carried only the declared packages. An undeclared import therefore stopped resolving because of an unrelated missing package. The install now also links the remaining packages from the project's `node_modules`.

  The run reports what happened. It warns which `node_modules` it did not reuse, what that directory is missing, and which undeclared packages it carried over. In `--json` mode, a failure from an unresolved package now carries the same hint that human and agent runs already printed.

## 1.11.0

### Minor Changes

- b802727: The CLI has a new `qawolf issue update` command. It changes the description, name, priority, or status of an issue that the team owns. Fields that you do not give stay unchanged. The command was absent because an earlier contract gave the input as a union of branches, which has no flat set of fields for the command generator to make flags from. The installed contract gives the input as one object, so the generator makes the command from it like the other issue commands.
- 1109f10: The `qawolf-cli` skill has a new reference file, `references/run-results.md`, for reading what `qawolf run get` returns. It explains the fields that a passing run does not show, such as a flow's failure diagnosis; the rules for the artifact URLs, which expire and can give a 404; and how to read the Playwright trace that `traceUrl` downloads. A trace is newline-delimited JSON, so an agent in a shell can pair each call with its result and find the failure without the trace viewer. The field list is generated from the contract, so it cannot drift from the installed version. Command help is unchanged.

### Patch Changes

- bad54bc: The help for a generated command now lists the permitted values of a flag that accepts a closed set, such as `qawolf issue update --status` or `qawolf issue find --statuses`. Before, these flags showed no values, and a caller found them only from the error message of a rejected command. The values come from the contract, so they cannot disagree with what the API accepts. A flag that already has help text keeps it, and the values come after it.

## 1.10.0

### Minor Changes

- 05e2572: `qawolf runner run --follow` now reports only the run's status — an "in progress" line, then whether it passed or failed — instead of streaming every log line the run produces. The full log stream is available behind the new `--logs` flag, and two more flags mirror further streams into the follow as JSON lines: `--run-events` for the run's progress events and `--recorder-events` for the browser actions the runner records after an anchor taken just before submission. Each stream flag implies `--follow`. Anything parsing a followed run's stdout should expect at most one in-progress status entry by default and read the outcome from the exit code; pass `--logs` to keep receiving log lines, and follow one stream flag at a time when parsing — combined mirrors interleave without a stream label.

## 1.9.2

### Patch Changes

- 62d07c4: move appium-uiautomator2-driver to devDependencies and remove it from the managed runtime

  The runtime does not load this driver from node_modules. Appium loads it from APPIUM_HOME, where `qawolf install android` installs it.

  The devDependency stays so the build can read the pinned version for the APPIUM_HOME install.

  This prevents lockfile churn in consumer repositories when a future driver version ships a problematic npm-shrinkwrap.json.

- a442520: Teach the shipped `qawolf-cli` skill the runner group, written for a harness that has a shell, an API key and its own vision model and none of QA Wolf's tooling.

  The guide is a skill resource rather than part of the skill body, so it costs nothing until a runner is what the task needs. It leads with what is expensive to discover: relaunching an id attaches rather than billing a second pod; a runner launched for you has a fresh browser with nothing signed in and no page open; only a run starts the screen, so a screenshot before one fails however long you wait; the recorder carries the `locator` and `alternates` a screenshot cannot give you; `exec` returns whether a snippet ran and not its value, so results come back through the `console` stream; and an unreachable answer from `qawolf runner run` does not mean the run did not start, so resubmitting bills a second one. Auth and the reads-versus-writes framing account for the group as well.

## 1.9.1

### Patch Changes

- 3268fd4: `qawolf install android` now installs the uiautomator2 driver at 4.2.9 rather than 3.7.0, which carries patched `body-parser`, `cross-spawn`, `path-to-regexp` and `brace-expansion`. The driver pins those itself through a bundled `npm-shrinkwrap.json`, so bumping the driver is the only thing that can move them.

  A machine that already has the driver keeps the version it has, because `install android` skips the step whenever a uiautomator2 driver is present. Updating it by hand needs `APPIUM_HOME` pointed at the CLI-managed Appium home — a bare `appium driver update` would update your default `~/.appium` instead and leave the CLI still on 3.7.0:

  ```bash
  # macOS
  APPIUM_HOME="$HOME/Library/Application Support/qawolf-nodejs/appium" \
    appium driver update uiautomator2
  # Linux
  APPIUM_HOME="$HOME/.local/share/qawolf-nodejs/appium" \
    appium driver update uiautomator2
  ```

  `qawolf doctor` only checks that a uiautomator2 driver is present, so it passes on 3.7.0 too. To confirm the version, run `appium driver list --installed` with the same `APPIUM_HOME`.

- c213833: `qawolf runner` commands now wait up to 60 seconds for the platform to answer, up from 15. Runner calls are answered by a live runner doing the work — starting a browser, evaluating a snippet, capturing a screen — and the first action on a fresh runner regularly needs longer than 15 seconds, which made the CLI report a timeout for work that was still finishing.

## 1.9.0

### Minor Changes

- 8c97c28: Update `@qawolf/api-contracts` to 0.25.0. Environment responses now identify
  the default environment, and `qawolf run get` includes attempt artifacts and
  failure diagnoses when available.
- d2460a7: Add `qawolf runner screenshot`, `act`, `exec` and `keepalive`, so a caller with a shell and its own vision model can close the see-and-act loop against an interactive runner.

  `qawolf runner screenshot` writes the runner's screen to a file, decoding the image on the way, and keeps the three ways it can have no image apart: the runner has not run anything yet, so nothing has started its screen (run a flow); the screen is up but cannot serve this instant (retry); the runner has no screen at all (launch a different image). `qawolf runner act <action>` performs one raw action in the computer-use vocabulary a vision model emits, validated against the published schema before it is sent, and accepts a whole action as JSON on stdin so a model's tool call can be forwarded unchanged. `qawolf runner exec <file|->` evaluates a snippet against the live page, with `--file` to give it the scope of one of your own files; it reports whether the snippet ran, and points at the `console` stream for anything it printed. `qawolf runner keepalive` resets a runner's inactivity clock for a caller that pauses between actions.

- 7275358: Add `qawolf runner`, a command group for driving an interactive runner on the QA Wolf platform.

  `qawolf runner launch` starts one and makes it this directory's default; `qawolf runner stop` stops it. `qawolf runner run <file>` ships the current directory's runnable files and runs a flow on the runner, and with `--follow` streams the run's logs until the run settles. `qawolf runner events <stream>` prints a runner's journal one entry per line, so `--tail`, `--since`, `--run` and `--follow` compose with `grep` and `jq`; `--json` prints the whole envelope. Every `--follow` is bounded by `--timeout` (an hour by default), because reading a runner keeps it alive and billing.

  Runner-targeting commands take an optional `--runner <id>`, falling back to `QAWOLF_RUNNER_ID` and then to the runner stored for the directory. A command with no runner available launches one and says so, naming it, so a caller knows the browser it is now driving is fresh. A launch that fails still names the runner it was launching, because a launch whose answer was lost may have started one: relaunching that same id attaches to it rather than starting a second.

  Under `--json`, and so in CI, a followed run's logs are printed as journal entries rather than as bare text, which keeps everything the command writes to stdout parseable as one stream.

### Patch Changes

- a76fbcd: `qawolf runner screenshot` asks for a runner that already has a screen instead of starting one, and `qawolf runner exec` names the missing page rather than the runner's image.

  A runner's virtual desktop starts with its first run, so a runner launched to serve a screenshot would have no screen and could only answer `screen-needs-a-run`. `screenshot` refuses instead, and names both things it needs: a runner, and a run on it. That also keeps the group readable, because no `read` command starts a runner.

  A `node20WithPlaywright` runner with no live page does run a browser and simply has nothing open on it yet, so `qawolf runner exec` points at the page rather than at the runner's image. Checking the image stays as the secondary possibility, since it is the case that never clears.

- 7275358: `qawolf runner` now passes on the reason QA Wolf gave for refusing a request, instead of only the status code.

  Running a file that is not a flow used to answer "runner.runFlow request failed (HTTP 400)" and stop there, while the server had already said which file was wrong and that an entry point has to be a flow file under `src/flows`. That sentence now reaches the caller, on `run`, `stop`, `screenshot`, `act` and `exec` alike.

## 1.8.1

### Patch Changes

- e8e5c96: update tar to 7.5.21 and refresh transitive dependencies to patched versions
- 8acd430: remove the unused appium-xcuitest-driver dependency

  The CLI does not support iOS targets, so it never installs, loads, or resolves this driver.

  The driver ships a bundled npm-shrinkwrap.json that makes npm write 41 extraneous entries into the package-lock.json of consumer repositories on each install.

  The managed runtime environment now installs approximately 430 fewer packages.

## 1.8.0

### Minor Changes

- b5fbb8a: Update `@qawolf/api-contracts` to 0.24.0. `qawolf runner takeScreenshot` joins
  the generated commands, and `qawolf run create` takes `--ai-task-id`
  (also readable from `QAWOLF_AI_TASK_ID`).

## 1.7.5

### Patch Changes

- 8680389: Show a per-file counter while `flows pull` downloads team-storage assets. The progress line now reads "Downloading team-storage assets (2/12)" and advances as each file starts. The total counts only files that download; reused and skipped files are not included. In human mode the spinner label updates in place, and when a download fails the error line keeps the last counter so you can see where it stopped. Agent mode writes one progress line per file to stderr. The json output does not change.
- 8094697: Let large signed-URL downloads finish on slow links. Before this change, flow-bundle and team-storage asset downloads had a fixed 30-second deadline for the full download. A large asset, for example a video file, could not finish in time and `flows pull` failed with a timeout. The 30-second window is now a stall timeout. The timer resets each time data arrives, so a slow download that makes progress can run to completion. A download that receives no data for 30 seconds still fails, and the error message now says the download stalled.
- e58f2dc: Stream signed-URL downloads to disk instead of buffering them in memory. Before this change, the CLI held the whole file in memory and briefly needed about twice the file size, so a multi-gigabyte asset could exceed the memory limit of a small CI container. The download now writes each chunk to a `.part` file and renames it into place when the download completes, so peak memory stays near one chunk for any file size. A pull of a 1.4 GB asset now peaks at about 290 MB of memory instead of 3.3 GB. A failed download removes the partial file, and slow disk writes do not count toward the 30-second stall timeout.

## 1.7.4

### Patch Changes

- 837d79e: Use `QAWOLF_ENVIRONMENT` as the default for generated public API `--environment-id` options. Pass `QAWOLF_AI_TASK_ID` to the public `run create` API input when the generated `--ai-task-id` option is available. Explicit flags take precedence over the environment.
- 80e3be3: Show the server's reason when a public API call fails, instead of only an HTTP
  status. A rejected request now prints why it was rejected without needing
  `--verbose`.
- fc8b048: Skip `runner.performAction` in the generated public API commands. An upcoming `@qawolf/api-contracts` version adds this contract, and its action-union input has no flag form; without the skip, upgrading the dependency would make command generation throw while the program is built, breaking every command. The verb will get a hand-written command instead.

## 1.7.3

### Patch Changes

- 1f57b57: Align browser install and doctor with the pinned playwright runtime. The CLI shipped an unused `@playwright/test` dependency, and user projects can install their own copy at any version. Both packages declare a `playwright` bin, and either can win the `node_modules/.bin/playwright` shim. When the shim belongs to a different version than the pinned `playwright`, `install browsers` downloads browser builds for the wrong playwright version. The flow runtime imports the `playwright` module, so it could not launch the installed builds. This change removes the `@playwright/test` dependency. `install browsers`, `doctor`, and runtime-dir validation now run the `playwright` package's own `cli.js` through the CLI's runtime, so the installed builds always match the runtime. `doctor` now also fails with a clear message when the installed playwright version differs from the pinned runtime version.
- 563dbd7: Make `init` repair an existing package.json so the scaffolded flow can load. The scaffolded flow and config are ES modules. Node reads their module format from the nearest package.json `type` field. Before this change, `init` only added the `test:e2e` script to an existing package.json. It did not set `"type": "module"` and did not add the `@qawolf/flows` dependency, so the example flow failed to load. Current npm writes `"type": "commonjs"` into every `npm init -y` package.json, so an explicit value does not signal author intent. `init` now offers three changes in one prompt: add the `test:e2e` script, set `"type": "module"`, and add the `@qawolf/flows` dependency. It applies the missing ones and skips the rest. It prints a warning after it changes an explicit `type` value, because that changes how every `.js` file in the package loads. Run `init` again on a half-configured project to repair it; the old code stopped at the first existing script.
- 163f6aa: Show flow failure detail in json output. Before this change, a failed `flows run` printed only `{"type":"error","title":"N flow(s) failed"}` in json mode. The CLI also selects json mode in CI and when stdout is piped. The failure message and stack only reached disk through the `--junit` report. The final error event now includes a `body` field. The `body` field contains the message and the cause stack for each failed flow. Human and agent modes do not change. They already show the failure detail inline.

## 1.7.2

### Patch Changes

- 7eb3322: Resolve environment aliases before flows commands use them. `flows pull --env <alias>` and `flows run --env <alias>` failed with an HTTP 400 because the CLI sent the alias to an endpoint that requires an environment id. The CLI now resolves an explicit `--env` value, and a `QAWOLF_ENVIRONMENT` value, through the `environment.get` public API. That endpoint accepts an id or an alias and returns the canonical id. Only the id goes to later requests, so `--env <alias>` and `--env <id>` now write to the same `.qawolf/<id>/` cache directory. When the resolution fails, the error names the environment value and tells you that aliases require a team API key.

## 1.7.1

### Patch Changes

- daf62a1: Correct the agent skill to use `QAWOLF_ENVIRONMENT`, matching the environment variable consumed by CLI flow commands.
- 1a4558f: Improve the bundled agent skill with reusable environment selection, result reuse, and safe write guidance, and regenerate command documentation from `@qawolf/api-contracts` 0.22.0.

## 1.7.0

### Minor Changes

- cb5d34e: Upgrade Playwright from 1.58.2 to 1.62.0

### Patch Changes

- 1b2234d: Document cross-harness Agent Skill installation and declare the CLI runtime requirement in the portable skill metadata.

## 1.6.0

### Minor Changes

- e8acd95: `qawolf auth whoami` now works with organization and user API keys, not just team keys. With an organization key it shows the organization; with a user key it shows the signed-in user (email) and their organization. Previously any non-team key failed with "Could not verify API key: unexpected response format".

### Patch Changes

- cb561d7: Teach agents to load the QA Wolf CLI skill for environment-variable and other public API tasks, and document how to use the current environment id.

## 1.5.0

### Minor Changes

- 3bc67bf: `flows pull` and `flows list --remote` no longer require `--env`. When the flag is omitted, the CLI reads `QAWOLF_ENVIRONMENT`, and in an interactive terminal it otherwise lists the team's environments and prompts for a pick — auto-selecting when only one exists. Teams with both static and preview (PR) environments first pick a kind, so ephemeral PR environments don't drown out the static ones. Non-interactive runs without a flag or env var still fail with a clear error, so CI and agent behavior stays deterministic.

  The `@qawolf/api-contracts` bump to 0.14.0 also adds three generated commands: `environment find`, `environment setVariable`, and `flow addTag`.

- 9e1a5c5: The CLI now checks the npm registry for a newer published version while a command runs. After the command completes, the CLI shows an update notice one time for each new version. Human mode shows a styled note. Agent mode writes plain text to stderr. JSON mode writes a note diagnostic to stderr and does not change stdout. Set QAWOLF_NO_UPDATE_CHECK=1 to disable the check.

## 1.4.2

### Patch Changes

- f759778: Fix Windows runs failing with "Could not load @qawolf/testkit ... Received protocol 'c:'". The Node ESM loader requires file:// URLs for absolute paths on win32, so the testkit, Playwright, and emails loaders now convert resolved paths before dynamic import.

## 1.4.1

### Patch Changes

- 5d43046: A request that runs out of time now says it timed out and how long it waited, instead of reporting an unreachable host and sending you to check your network and `QAWOLF_HOST_URL`.

  Behind that, a call can now carry its own deadline rather than sharing one fifteen-second limit with everything else. Nothing changes for calls the platform answers from its database, which is all of them today; the endpoints whose work genuinely takes longer can ask for the time they need.

- ba45b94: Stage flow files correctly on Windows. Flow discovery returned forward-slash paths from the glob, while the rest of the CLI builds paths with `node:path` and gets backslashes. The staging step compared the two, never matched, and returned the original source path. `qawolf flows run` then executed flows from the project tree instead of the prepared run directory, so a flow resolved whatever Playwright the project had installed rather than the pinned executor, and a flow importing `#playwright` failed. Flow discovery now returns one canonical path form.
- e7cf799: Find Playwright and Appium correctly on Windows. The CLI accepted two shim names: the `.cmd` wrapper npm writes, and the extension-less POSIX script. It missed the `.exe` shim `bun install` writes, so `qawolf doctor` reported Playwright as missing, and `qawolf flows run` and `qawolf install browsers` failed on a project installed with bun. It also counted the extension-less script as usable, which Windows cannot launch — `CreateProcess` reports `ENOENT` for a path with no executable extension, even when the file is present. `qawolf doctor` then reported Playwright as installed, and `qawolf flows run` failed with an error naming a file the user can see on disk. Both bugs also gated the pinned-dependency check, so the CLI either reinstalled its runtime on every run or read an unusable directory as fully installed. `appium` carried the same names and the same two bugs, which broke Android flows and `qawolf install android`. The CLI now looks only for the `.cmd` and `.exe` shims on Windows. A project whose `node_modules/.bin` holds only the extension-less shim is now rejected, and the CLI installs its managed runtime instead. That affects a tree installed on Linux or macOS and then used from Windows, through a bind mount, a copied directory, or WSL. A project installed on Windows by npm or bun is unaffected.
- e7cf799: Fix `ENOENT` when the CLI spawns npm, Appium, or the Android SDK tools on Windows. `qawolf flows run` failed while preparing the environment. `qawolf doctor` reported npm and `appium` as not installed, even though both worked in the same shell. `qawolf install android` could not reach `sdkmanager` or `avdmanager`. Windows ships these tools as `.cmd` or `.bat` wrappers and ships no `.exe` alternative. Node's process spawn cannot execute a batch file directly. The CLI now names the wrapper file and runs it through `cmd.exe /d /s /c` with quoted arguments. The `adb` and `emulator` paths built from `ANDROID_HOME` now name the `.exe` suffix directly instead of relying on the spawn path search. Running the CLI inside WSL is unaffected, because it reports itself as Linux and carries POSIX tools.

## 1.4.0

### Minor Changes

- 4a0ac77: Update `@qawolf/api-contracts` to 0.11.0, expanding the generated command surface: `automate`, `environment create|get|listVariableNames`, `issue create|find|get`, `run find|get`, and `tag create` join the existing `run create` and `flows list --remote`.

  Contract inputs expressed as intersections (`run.create`, which now selects flows by id and/or tag) or discriminated unions (`issue.create`, bug vs coverage request) are now mapped to flags: intersection members merge into one flag set, and a union's literal discriminator becomes a required flag (`--type`, documented as "One of: bug, coverageRequest") with branch-specific fields optional. Validation still runs against the real contract schema before any network call, so branch rules and cross-field constraints keep their precise error messages.

- c269262: Add `--no-browser-deps` to `flows run`, `install`, and `install browsers`. On Linux the CLI runs `playwright install --with-deps`, whose OS dependency step shells out to `apt-get` and needs root — on non-root machines without sudo it hangs or fails at a `su` prompt (`playwright install chromium failed: Password:`) even when every system library is already installed. The new flag skips that step and only installs the browsers themselves, so non-root environments with preinstalled system libraries (for example CI images baked with `playwright install-deps`, or a shared `PLAYWRIGHT_BROWSERS_PATH` cache) can run web flows. Default behavior is unchanged; if libraries are missing at launch, Playwright reports the exact packages to install.

## 1.3.2

### Patch Changes

- d55f6ab: Fix `ERR_MODULE_NOT_FOUND: Cannot find package '@qawolf/flows'` when a project dependency (such as `@qawolf/pom`) peer-depends on a pinned runtime package. The per-run install skips peer dependencies (`--legacy-peer-deps`) and the pinned packages were only resolvable from staged flow files, not from installed project dependencies. The outer hop now links every pinned package alongside the installed dependencies, so project packages resolve the same pinned instance the executor uses. Also bumps the pinned `@qawolf/flows` to 0.1.4 and pins its new peer `expect-webdriverio`.
- 7a2f1d1: Record video, HAR, and trace artifacts for browser contexts that flows create themselves via `browser.newContext()` — previously only the context `launch()` returned was recorded, so flows using helpers that build their own context produced empty artifacts. Each context now writes to its own file (`<flow>.har`, `<flow>-2.har`, …).

## 1.3.1

### Patch Changes

- ac2d20d: Allow `QAWOLF_HOST_URL` to target a custom QA Wolf deployment host.

## 1.3.0

### Minor Changes

- 77ba95c: `flows list --remote` is now environment-scoped via the QA Wolf public API: pass `--env <env>` (now required with `--remote`) and optionally `--include-drafts` to include draft flows. JSON output now emits `flowId` instead of `id` for each flow.

### Patch Changes

- db51021: Fix a crash in the exit path when a command fails before the log file opens (a "sonic boom is not ready yet" stack trace printed after the error message). The log fd now opens eagerly at creation while writes stay asynchronous.
- 8f603dd: Skip public-API command generation for contracts served by hand-written commands, so a future `flow.list` contract does not mint a duplicate of `qawolf flows list --remote`.

## 1.2.0

### Minor Changes

- c2e13b2: Support Node 20. The `engines.node` floor is lowered to `>=20.19.0`, and on Node
  versions without native TypeScript support (Node 20, and Node 22.15–22.17) flows
  are now loaded through the `@oxc-node/core` ESM loader, which transpiles and
  resolves TypeScript at runtime. Bun and Node 22.18+ are unaffected. A CI matrix
  smoke-tests the published bundle on Node 20, 22, 24, and Bun.

  Note: the `@qawolf/*` platform packages currently declare `engines.node >=22.22.0`,
  so installing on Node 20 prints `EBADENGINE` warnings. They are verified to run on
  Node 20.19, and the warnings are non-fatal unless `engine-strict` is enabled.

### Patch Changes

- cae4b3d: Provide shared local flow runtime dependencies for email inboxes and environment variable persistence across web and Android flows.
- f69f2de: Fix `ERR_MODULE_NOT_FOUND` for correctly declared flow dependencies: dependency discovery now validates an ancestor `node_modules` before reusing it, and falls back to installing the project's declared deps when none satisfies them (reported as `Installing N project dependencies…`).

## 1.1.0

### Minor Changes

- 38f4903: Resolve flow runtime dependencies through a layered, project-isolated `node_modules` so flows run correctly in monorepos, single-package projects, and empty directories across both the Node and compiled-binary channels. The CLI-owned executor is always pinned and never pollutes or is shadowed by the surrounding project, while the flow's own declared dependencies still resolve. Adds `qawolf install clear` to wipe the managed runtime cache.

### Patch Changes

- 2d98dc9: Exit `flows run` deterministically once the run completes. The flow runtime can launch browser processes (e.g. a channel-launched Google Chrome) whose CDP sockets and timers keep Node's event loop alive after teardown, so the CLI previously printed its results and then hung indefinitely. The process now flushes stdout/stderr and exits with the run's exit code (1 on flow failure, 0 on pass) as soon as the command resolves, with a backstop in case a stream stalls.
- 5a81d70: Resolve the `#playwright` subpath import when running flows in the isolated managed runtime. QA Wolf flow bundles import Playwright through a Node.js `imports` alias (`#playwright`), but the pulled bundle's `package.json` omits the `imports` field, so the staged `exec/package.json` could not resolve it and flows failed with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. The CLI now merges the `#playwright` alias into the staged `exec/package.json`, pointing it at the pinned Playwright resolved through the inner-hop `node_modules` symlink — fixing both the Node import path and the compiled-binary bundle path.
- 621f5d4: Resolve flow imports whose specifier uses a `.ts` extension but ships as `.js` (and vice versa). Platform-generated bundles often import sibling utilities as `.ts` while the file on disk is `.js`; native Node ESM resolves extensions literally and throws `ERR_MODULE_NOT_FOUND`. A synchronous `module.registerHooks` resolve hook now transparently retries the sibling source extension (`.ts`↔`.js`, `.mts`↔`.mjs`, `.cts`↔`.cjs`) only on resolution failure — literal matches always win and nothing is rewritten on disk. Raises the Node engine floor to `>=22.15.0`, the release that introduced synchronous hooks.

## 1.0.1

### Patch Changes

- 99e891c: Change the default `flows run` output directory from `qawolf-output` to `.qawolf/output`, so run artifacts (videos, traces, HAR) land under the `.qawolf/` directory that `qawolf init` gitignores. Pass `--output-dir` to override.
- f58d9cd: Save HAR and trace artifacts reliably from `flows run`. HAR (and video) could be silently dropped because contexts and browsers were closed concurrently, racing Playwright's artifact flush; contexts now close first. The `--trace` flag is now wired end-to-end and writes a Playwright trace to `<output-dir>/trace/<flow>.zip`, honoring `on`, `off`, and `retain-on-failure`.
- 3b4fdb7: Normalize the `bin` entry to `dist/cli.js` so npm no longer rewrites it (with a publish warning) when publishing.
- 238d11a: Round-trip environment variables whose keys are not POSIX shell identifiers (e.g. OTP URIs keyed by email) when running flows locally, instead of failing or dropping them.
- 51e8fc3: Wire `flows run --timeout` into the web flow expect timeout. Previously the flag only set Playwright's per-action timeout, so assertion failures still waited the hardcoded 30s default; it now applies to actions and assertions alike.

## 1.0.0

### Major Changes

- 9b946e0: Initial public release of the QA Wolf CLI — run QA Wolf flows from your terminal or CI.

  Highlights:
  - `qawolf auth login` — authenticate with QA Wolf (or set `QAWOLF_API_KEY` in CI)
  - `qawolf flows run --env <env-id>` — pull and run your team's flows locally
  - `qawolf flows pull` — refresh the local flow cache
  - `qawolf run create --environment-id <env-id>` — trigger a run of your flows on the QA Wolf platform
  - `qawolf install` — install runtime dependencies (browsers, Android tooling)
  - `qawolf init` — scaffold a local-only project
  - `qawolf doctor` — diagnose setup problems

  Install with `npm install -g @qawolf/cli` (Node 22+), try it with `npx @qawolf/cli --help`, or download a standalone binary for Linux, macOS, or Windows from GitHub Releases. Full documentation at [docs.qawolf.com](https://docs.qawolf.com).

### Minor Changes

- 61fa3f6: Add a contract-driven public API command layer: every contract published in
  `@qawolf/api-contracts` automatically becomes a `qawolf <namespace>
<action>` command, starting with `qawolf run create`.
- 03817c8: Add the `qawolf-cli` Agent Skill (`skills/qawolf-cli/SKILL.md`): lean, task-first guidance for coding agents — auth, output modes, read/write safety, and a command index that delegates flag reference to `qawolf <command> --help`. The `skills/` directory ships in the npm package.

### Patch Changes

- d7ea923: Agent mode (`--agent`) now emits structured results as JSON on stdout (human-readable progress stays on stderr).
- 5905699: Exit with code 3 (auth) instead of 1 when the API key is missing or invalid, and clean up `--help` output: remove an internal note from the `--trace` flag description and give the `run` command group a curated description.
- 9cbd6c2: Harden tar extraction in `flows pull` to reject archive entries with an unknown size, and restore flow-discovery and runner logging in `flows run --env` mode.
