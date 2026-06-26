import { repoShapes } from "../fixtures/shapes.js";
import type { Suite } from "../harness/types.js";

/** First suite: every repo shape, on both the node and binary channels. */
export const repoReadinessSuite: Suite = {
  name: "repo-readiness",
  cases: repoShapes,
  channels: ["node", "binary"],
};
