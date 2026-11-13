import { expect, flow } from "@qawolf/flows/android";

export default flow(
  "android-expect",
  "Android - Pixel 9 (Android 15)",
  async () => {
    expect(1 + 1).toBe(2);
  },
);
