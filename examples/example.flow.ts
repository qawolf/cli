import { flow } from "@qawolf/flows/web";

export default flow(
  "Visit example.com",
  { target: "Web - Chrome", launch: true },
  async ({ test, page }) => {
    await test("page is open", async () => {
      if (!page) throw new Error("no page after launch");
    });
  },
);
