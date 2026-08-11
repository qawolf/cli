export const initMessages = {
  title: "QA Wolf",
  outro:
    "Run `qawolf auth login`, then `qawolf flows pull`, then `qawolf flows run`.",
  createPackageJsonPrompt: "Create package.json (required to run flows)?",
  skippedCreatingPackageJson: "Skipped package.json",
  skippedUpdatingPackageJson: "Skipped updating package.json",
  createdPackageJson: "Created package.json",
  packageJsonInvalidJson:
    "`package.json` contains invalid JSON. Correct the JSON syntax, then run `qawolf init` again.",
  packageJsonNotAnObject:
    "`package.json` must contain a JSON object. Update it, then run `qawolf init` again.",
  packageJsonMalformedSection: (field: string) =>
    `The \`${field}\` field in \`package.json\` must be a JSON object. Update it, then run \`qawolf init\` again.`,
  packageJsonHasTestE2e:
    "package.json already has `test:e2e` — leaving it as is",
  packageJsonUpToDate: "package.json already configured — nothing to update",
  typeChanged: (from: string) =>
    `Changed "type" from "${from}" to "module" — .js files in this package now load as ES modules.`,
  pkgChanges: {
    script: "add `test:e2e` script",
    type: 'set "type": "module"',
    flowsDep: "add @qawolf/flows dependency",
  },
  updatePackageJsonPrompt: (changes: readonly string[]) =>
    `Update package.json (${changes.join(", ")})?`,
  updatedPackageJson: "Updated package.json",
  overwritePrompt: (relPath: string) => `Overwrite ${relPath}?`,
  skippedFile: (relPath: string) => `Skipped ${relPath}`,
  createdFile: (relPath: string) => `Created ${relPath}`,
} as const;
