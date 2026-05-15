import { flow } from "@qawolf/flows/android";

export default flow(
  "android-fail",
  "Android - Pixel 9 (Android 15)",
  async () => {
    throw new Error("android flow failed");
  },
);
