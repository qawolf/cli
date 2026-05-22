import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { createAgentRenderers } from "./agent.js";
import { createHumanRenderers } from "./human.js";
import { createJsonRenderers } from "./json.js";
import type { RendererSet } from "./types.js";

export type { RendererSet } from "./types.js";

export function pickRenderers(
  mode: OutputMode,
  clack: StyledClack,
  verboseTarget?: { write: ((msg: string) => void) | undefined },
): RendererSet {
  switch (mode) {
    case "human":
      return createHumanRenderers(clack, verboseTarget);
    case "agent":
      return createAgentRenderers();
    case "json":
      return createJsonRenderers();
  }
}
