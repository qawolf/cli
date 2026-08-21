---
"@qawolf/cli": minor
---

The `qawolf runner` group speaks `@qawolf/api-contracts` 0.27.0, gains four commands, and ships a run's files by walking the flow's imports instead of reading the whole directory.

`qawolf runner run` now sends the flow file, everything it imports, and your `package.json` and `tsconfig.json`. Nothing else travels. Before this change it read every runnable file under the working directory, so on a project of a few thousand files it built a payload the platform refused on size and the run never started; you had to run from a directory holding the flow and little else. Imports are followed the way a run from the QA Wolf app follows them, including its limits: relative paths and `tsconfig.json` aliases, resolving `.ts` and `.js`, and not following `export ... from` or `require()`.

After the first run on a runner, later runs send only the files whose content changed. The baseline lives in `.qawolf/runner-files.json`. A switch to another runner ignores it, a runner that turns out not to hold what was claimed gets the whole set resent, and `--json` reports which happened as `fileSync`.

`qawolf runner run --lines 12-40` runs those lines against the browser as it stands, so you can iterate on one step without paying for the whole flow to reach it again. `--lines-file` says where the range lives when it is not the flow file, and the positional is now `<flowFile>` in the usage line because two file paths with one unlabelled is easy to get backwards. `--env-file` gives the run environment variables from a dotenv file, in the format `qawolf flows pull` writes.

`qawolf runner inspect` reads one thing off the live page and prints it on stdout by itself: `element-html --selector`, `page-html`, or `variable --name`, which is a shorter path to a value than printing it from a snippet and reading it back out of the `console` stream. `qawolf runner stop-run` stops what a runner is executing and leaves the runner up. `qawolf runner import-package` installs a package into a live run so a snippet or a selection can import it without a full run to reinstall dependencies.

Two breaking changes to the `runner` group. `qawolf runner stop` is now `qawolf runner terminate`, which better separates ending a runner from stopping a run on one. And `--name` takes a runner family, `playwright`, `android`, `ios` or `basic`, in place of an image name like `node20WithPlaywright`. Every runner verb also reports a failure as an `outcome` of `failure` with a `failureReason`, in place of one outcome per condition, so `--json` consumers reading `outcome` for a specific condition need to read `failureReason` instead.
