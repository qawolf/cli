import { flow } from "@qawolf/flows/android";

// The target has the meta fields for the AVD name, but it does not parse as an
// execution target, so the runner cannot configure the flow runtime with it.
export default flow(
  "android-invalid-target",
  {
    platform: "android",
    schemaVersion: 1,
    meta: { androidVersion: "15", deviceModel: "Google Pixel 9" },
  } as never,
  async () => {},
);
