# Releasing

`@qawolf/cli` uses [Changesets](https://github.com/changesets/changesets) to manage versions and publish to npm.

## Prerequisites

Before the first publish:

- `NPM_TOKEN` must be set as a GitHub Actions secret (Settings → Secrets → Actions → New repository secret).

## How to add a changeset

When your PR includes a user-facing change (bug fix, new feature, or breaking change), add a changeset:

```bash
bunx changeset
```

Select the bump type (`patch`, `minor`, or `major`) and describe the change. Commit the generated `.changeset/*.md` file with your PR.

PRs that do not affect the published package (CI config, internal tooling, docs) do not need a changeset.

## Release flow

1. One or more PRs with changeset files merge to `main`.
2. The [Release workflow](../.github/workflows/release.yml) detects the pending changesets and creates (or updates) a **"Version Packages"** PR. This PR bumps `package.json` version and updates `CHANGELOG.md`. It runs automatically, with no approval required.
3. Review the Version Packages PR and merge it when ready to ship.
4. Merging the Version Packages PR triggers the workflow's `Publish` job, which pauses for approval of the `release` environment (Actions → the run → "Review deployments"). Once approved, it builds the package and runs:

   ```bash
   bunx changeset publish
   ```

   `changeset publish` publishes to npm and creates a git tag for the new version. The changesets action pushes that tag and creates a GitHub Release from it, which triggers the binary build pipeline. npm [provenance](https://docs.npmjs.com/generating-provenance-statements) is enabled via the `NPM_CONFIG_PROVENANCE: true` env var on the publish step.

Merges to `main` with no pending changesets and an already-tagged version (docs/CI-only merges) skip both the version and publish jobs, so they never leave a run stuck awaiting approval.

## After publish

Verify the release:

```bash
npm view @qawolf/cli version   # should match the version in package.json
qawolf --version               # should match package.json version
```

## Re-running a failed publish

If the publish step fails (e.g. network issue after the version PR was merged), re-run the Release workflow from the GitHub Actions UI (Actions → Release → Re-run jobs). This requests approval of the `release` environment again. "Re-run failed jobs" preserves the `mode` job's outputs, so the `Publish` job re-runs without re-evaluating whether a publish is needed. If the version was already partially published, npm will return an error indicating the version exists — in that case, cut a patch release with a new changeset rather than attempting to re-publish the same version.
