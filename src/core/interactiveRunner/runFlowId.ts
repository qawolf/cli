import { interactiveRunnerMessages } from "~/core/messages/index.js";

/**
 * The flow a run is for, from the flag alone. A blank flag is refused, like a
 * blank `--env-id`. The process's own `QAWOLF_WORKFLOW_ID` is not read: only
 * an AI Job's pod has one, and it names the pod's flow, not every flow run
 * from there.
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
