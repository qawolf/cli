import { FailWithoutRetryError } from "@qawolf/flows";
import { flow } from "@qawolf/flows/web";

export default flow("failNoRetry", "Web - Chrome", async () => {
  throw new FailWithoutRetryError();
});
