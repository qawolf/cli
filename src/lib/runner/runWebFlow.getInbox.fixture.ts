import { flow } from "@qawolf/flows/web";

// oxlint-disable-next-line @typescript-eslint/no-deprecated
export default flow("getInbox", "Web - Chrome", async ({ getInbox }) => {
  await getInbox({ id: "test" });
});
