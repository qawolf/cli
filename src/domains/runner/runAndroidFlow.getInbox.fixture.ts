import { flow } from "@qawolf/flows/android";

export default flow("getInbox", "Android - Pixel 9", async (deps) => {
  // oxlint-disable-next-line typescript/no-deprecated -- verifies CLI wiring for legacy getInbox dep
  await deps.getInbox({ address: "test@example.com" });
});
