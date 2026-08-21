import { interactMessages } from "./interact.js";
import { lifecycleMessages } from "./lifecycle.js";
import { runMessages } from "./run.js";

export const interactiveRunnerMessages = {
  ...lifecycleMessages,
  ...runMessages,
  ...interactMessages,
} as const;
