import {
  type BrowserActionFlags,
  buildBrowserAction,
  parseBrowserAction,
} from "~/core/interactiveRunner/browserAction.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

import type { InteractiveRunnerDeps } from "./deps.js";

/** `-` reads a whole action as JSON, which is the forward-a-tool-call path. */
const stdinArgument = "-";

/** Reads one action off the command line, or off stdin when `type` is `-`. */
export async function readAction(
  type: string,
  flags: BrowserActionFlags,
  deps: InteractiveRunnerDeps,
): Promise<ReturnType<typeof buildBrowserAction>> {
  if (type !== stdinArgument) return buildBrowserAction(type, flags);

  // Refused rather than ignored, for the same reason `act click --text hi` is:
  // a flag that does not reach the runner has to be answered, because dropping
  // it performs a different action than the one that was asked for.
  if (Object.values(flags).some((value) => value !== undefined)) {
    return { error: interactiveRunnerMessages.actionFlagsWithStdin, ok: false };
  }

  const piped = (await deps.readStdin()).trim();
  if (piped === "") {
    return { error: interactiveRunnerMessages.stdinEmptyAction, ok: false };
  }
  try {
    return parseBrowserAction(JSON.parse(piped));
  } catch {
    return { error: interactiveRunnerMessages.actionNotJson, ok: false };
  }
}
