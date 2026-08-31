import { interactMessages } from "./interact.js";
import { lifecycleMessages } from "./lifecycle.js";
import { listMessages } from "./list.js";
import { runMessages } from "./run.js";

export const interactiveRunnerMessages = {
  ...lifecycleMessages,
  ...listMessages,
  ...runMessages,
  ...interactMessages,
} as const;
