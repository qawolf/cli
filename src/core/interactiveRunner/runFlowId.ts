import { interactiveRunnerMessages } from "~/core/messages/index.js";

/**
 * The flow a run is for, from the flag alone. A blank flag is refused rather
 * than read as "none", the way a blank `--env-id` is.
 *
 * `QAWOLF_WORKFLOW_ID` in this process's own environment is deliberately not
 * read. The only environment that holds it is an AI Job's pod, where it is the
 * id of that pod's own flow, which is not the flow of every run started there.
 */
export function resolveRunFlowId(
  flag: string | undefined,
): { ok: true; flowId: string | undefined } | { ok: false; error: string } {
  const flowId = flag?.trim();
  if (flowId === "") {
    return { error: interactiveRunnerMessages.flowIdBlank, ok: false };
  }
  return { flowId, ok: true };
}
