export const qawolfConfigTs = `export default {
  outputDir: ".qawolf",
  timeout: 60_000,
  retries: 0,
  video: "retain-on-failure",
};
`;

export const exampleFlowTs = `import { expect, flow } from "@qawolf/flows/web";

export default flow(
  "Example",
  { launch: true, target: "Web - Chrome" },
  async ({ page, test }) => {
    await test("navigate to example.com", async () => {
      await page.goto("https://example.com");
      await expect(page).toHaveTitle(/Example/);
    });
  },
);
`;

export const qawolfGitignore = `# QA Wolf output artifacts
*
!.gitignore
`;
