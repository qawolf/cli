import { flow } from "@qawolf/flows/web";

export default flow("getInbox", "Web - Chrome", async (deps) => {
  // oxlint-disable-next-line @typescript-eslint/no-deprecated
  await deps.getInbox({ id: "test" });
});
