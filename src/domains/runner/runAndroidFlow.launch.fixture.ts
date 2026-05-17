import { flow } from "@qawolf/flows/android";

export default flow(
  "android-launch",
  { target: "Android - Pixel 9 (Android 15)", launch: true },
  async ({ driver }) => {
    if (!driver) throw new Error("expected driver after android launch");
  },
);
