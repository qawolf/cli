import { flow } from "@qawolf/flows/android";

export default flow(
  "android-fail-no-retry",
  "Android - Pixel 9 (Android 15)",
  async ({ failWithoutRetry }) => {
    failWithoutRetry();
  },
);
