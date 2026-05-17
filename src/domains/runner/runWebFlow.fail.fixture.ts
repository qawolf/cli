import { flow } from "@qawolf/flows/web";

export default flow("fail", "Web - Chrome", async () => {
  throw new Error("flow failed");
});
