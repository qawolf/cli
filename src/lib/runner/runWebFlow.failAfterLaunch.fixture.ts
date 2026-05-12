import { flow } from "@qawolf/flows/web";

export default flow(
  "failAfterLaunch",
  { target: "Web - Chrome", launch: true },
  async () => {
    throw new Error("fail after launch");
  },
);
