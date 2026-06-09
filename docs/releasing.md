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
2. The [Release workflow](../.github/workflows/release.yml) detects the pending changesets and creates (or updates) a **"Version Packages"** PR. This PR bumps `package.json` version and updates `CHANGELOG.md`.
3. Review the Version Packages PR and merge it when ready to ship.
4. The Release workflow runs again. It detects no pending changesets, builds the package, and runs:

   ```
   bunx changeset publish
   ```

   `changeset publish` publishes to npm and creates a git tag for the new version. The changesets action pushes that tag and creates a GitHub Release from it, which triggers the binary build pipeline. npm [provenance](https://docs.npmjs.com/generating-provenance-statements) is enabled via the `NPM_CONFIG_PROVENANCE: true` env var on the publish step.

## After publish

Verify the release:

```bash
npm view @qawolf/cli version   # should match the version in package.json
qawolf --version               # should match package.json version
```

## Re-running a failed publish

If the publish step fails (e.g. network issue after the version PR was merged), re-run the Release workflow from the GitHub Actions UI (Actions → Release → Re-run jobs). If the version was already partially published, npm will return an error indicating the version exists — in that case, cut a patch release with a new changeset rather than attempting to re-publish the same version.
