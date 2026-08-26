# Releasing

`@qawolf/cli` uses [Changesets](https://github.com/changesets/changesets) to manage versions and publish to npm.

We publish each version to two registries. Our clients install from npmjs. Our internal builds get the package from [GitHub Packages](#github-packages).

## Prerequisites

Before the first publish:

- `NPM_TOKEN` must be set as a GitHub Actions secret (Settings → Secrets → Actions → New repository secret).

The publish to GitHub Packages needs no secret. It uses the built-in `GITHUB_TOKEN` of the workflow. That token can write the packages of this repository.

## How to add a changeset

When your PR includes a user-facing change (bug fix, new feature, or breaking change), add a changeset:

```bash
bunx changeset
```

Select the bump type (`patch`, `minor`, or `major`) and describe the change. Commit the generated `.changeset/*.md` file with your PR.

PRs that do not affect the published package (CI config, internal tooling, docs) do not need a changeset.

## Release flow

1. One or more PRs with changeset files merge to `main`.
2. The [Release workflow](../.github/workflows/release.yml) finds the pending changesets. Its `Version PR` job creates or updates a **"Version Packages"** PR. That PR bumps the `package.json` version and updates `CHANGELOG.md`. The job needs no approval.
3. Review the Version Packages PR and merge it when ready to ship.
4. The workflow runs again and starts its `Publish` job. That job waits for approval of the `release` environment. To approve it, go to Actions → the run → "Review deployments". The job then builds the package and runs:

   ```bash
   bunx changeset publish
   ```

   `changeset publish` publishes to npm and creates a git tag for the new version. The changesets action pushes that tag and creates a GitHub Release from it, which triggers the binary build pipeline. npm [provenance](https://docs.npmjs.com/generating-provenance-statements) is enabled via the `NPM_CONFIG_PROVENANCE: true` env var on the publish step.

5. Two jobs then run in parallel from the new tag. The first job builds the binaries. The second job publishes to [GitHub Packages](#github-packages).

Approval applies to the `Publish` job only. The `Detect release mode` job examines each merge first. If the merge has no pending changesets, and the version in `package.json` already has a tag, the workflow starts neither the `Version PR` job nor the `Publish` job. Merges of docs and CI changes are of this type, and they ask for no approval.

## GitHub Packages

An npm registry map applies to a full scope. It cannot apply to one package. Our internal builds map the full `@qawolf` scope to GitHub Packages. Thus we cannot send `@qawolf/cli` to npmjs and keep the other `@qawolf` packages on GitHub Packages. A version that is absent from GitHub Packages gives an `E404` error.

[`publish-github-packages.yml`](../.github/workflows/publish-github-packages.yml) corrects this. It gets the source at the release tag, builds the package again, and publishes it to `https://npm.pkg.github.com`. Three conditions are important if you change this workflow:

- Use the `--@qawolf:registry=` flag. The `.npmrc` file of this repo sets the `@qawolf` scope to npmjs. A project file has more control than a user file or an environment variable. npm also reads a scope key before the plain `registry` key. Therefore a `--registry` flag alone publishes to npmjs and gives no error.
- Do not use the `--access` flag. GitHub Packages refuses that flag. A package of the organization gets its visibility from the repository.
- Do not use provenance. Only npmjs makes an attestation, and a request for provenance here stops the publish. Therefore `NPM_CONFIG_PROVENANCE` stays on the changesets step in `release.yml`.

The job stops with no error if the version is already present. Therefore you can run the job again safely.

To publish a version that is older than this workflow, run the workflow alone. Go to Actions → Publish to GitHub Packages → Run workflow. Give the release tag, for example `v1.11.0`.

## After publish

Verify the release:

```bash
npm view @qawolf/cli version   # should match the version in package.json
qawolf --version               # should match package.json version
```

To verify the copy on GitHub Packages, use a token that has the `read:packages` scope. That registry needs authentication for each read, also for a public package.

```bash
npm view @qawolf/cli version --@qawolf:registry=https://npm.pkg.github.com
```

## Re-running a failed publish

If the publish step fails (e.g. network issue after the version PR was merged), re-run the Release workflow from the GitHub Actions UI (Actions → Release → Re-run jobs). The `Publish` job asks for approval again. Use "Re-run failed jobs" to keep the result of the `Detect release mode` job. If the version was already partially published, npm will return an error indicating the version exists — in that case, cut a patch release with a new changeset rather than attempting to re-publish the same version.

Do this before you merge more changesets. A new changeset starts a new version bump, and the version that failed then gets no publish.

If only the GitHub Packages job failed, run that job again. The job makes no change to npmjs, and a second run is safe.
