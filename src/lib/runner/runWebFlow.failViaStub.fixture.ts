import { flow } from "@qawolf/flows/web";

export default flow("failViaStub", "Web - Chrome", async (deps) => {
  // oxlint-disable-next-line @typescript-eslint/no-deprecated
  deps.failWithoutRetry();
});
