import { flow } from "@qawolf/flows/android";

export default flow(
  "android-fail-after-launch",
  { target: "Android - Pixel 9 (Android 15)", launch: true },
  async () => {
    throw new Error("android flow failed after launch");
  },
);
