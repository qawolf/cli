import { flow } from "@qawolf/flows/web";

export default flow(
  "Compat Smoke",
  { target: "Web - Chrome", launch: {} },
  async ({ page, test }) => {
    await test("navigates", async () => {
      await page.goto("https://example.com");
    });
  },
);
