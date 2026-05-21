export const initMessages = {
  title: "QA Wolf",
  outro:
    "Run `qawolf auth login`, then `qawolf flows pull`, then `qawolf flows run`.",
  createPackageJsonPrompt: "Create package.json (required to run flows)?",
  skippedCreatingPackageJson: "Skipped package.json",
  skippedAddingTestE2e: "Skipped adding test:e2e to package.json",
  createdPackageJson: "Created package.json",
  packageJsonInvalidJson:
    "package.json is not valid JSON — skipped adding `test:e2e`",
  packageJsonHasTestE2e: "package.json already has `test:e2e` — skipped",
  addTestE2ePrompt: "Add `test:e2e: qawolf flows run` to package.json?",
  updatedPackageJson: "Updated package.json",
} as const;
