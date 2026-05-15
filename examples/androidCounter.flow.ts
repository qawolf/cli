import { flow } from "@qawolf/flows/android";

export default flow(
  "android-counter",
  { target: "Android - Pixel 9 (Android 15)", launch: true },
  async ({ test, driver }) => {
    await test("app is launched", async () => {
      if (!driver) throw new Error("no driver after launch");
    });
  },
);
