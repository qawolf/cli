import { flow } from "@qawolf/flows/web";

// eslint-disable-next-line typescript-eslint/no-deprecated
export default flow("getInbox", "Web - Chrome", async ({ getInbox }) => {
  // eslint-disable-next-line typescript-eslint/no-deprecated
  await getInbox({ id: "test" });
});
