export const QAWOLF_CONFIG_TS = `export default {
  outputDir: ".qawolf",
  timeout: 60_000,
  retries: 0,
  video: "retain-on-failure",
};
`;

export const EXAMPLE_FLOW_TS = `import { expect, flow } from "@qawolf/flows/web";

export default flow(
  "Example",
  { target: "Web - Chrome" },
  async ({ launch, test }) => {
    const { page } = await launch();

    await test("navigate to example.com", async () => {
      await page.goto("https://example.com");
      await expect(page).toHaveTitle(/Example/);
    });
  },
);
`;

export const QAWOLF_GITIGNORE = `# QA Wolf output artifacts
*
!.gitignore
`;
