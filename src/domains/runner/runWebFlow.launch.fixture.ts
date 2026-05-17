import { flow } from "@qawolf/flows/web";

export default flow(
  "launch",
  { target: "Web - Chrome", launch: true },
  async (_ctx) => {},
);
