import { interactiveRunnerMessages } from "~/core/messages/index.js";

/**
 * The flow a run is for: the flag when given, else `QAWOLF_WORKFLOW_ID` from
 * the shell, which the pod an AI Job runs on exports. A blank flag is refused
 * rather than read as "none", the way a blank `--env-id` is.
 */
export function resolveRunFlowId({
  env,
  flag,
}: {
  env: Readonly<Record<string, string | undefined>>;
  flag: string | undefined;
}): { ok: true; flowId: string | undefined } | { ok: false; error: string } {
  const explicit = flag?.trim();
  if (explicit === "") {
    return { error: interactiveRunnerMessages.flowIdBlank, ok: false };
  }
  const fromEnvVar = env["QAWOLF_WORKFLOW_ID"]?.trim();
  return { flowId: explicit ?? (fromEnvVar || undefined), ok: true };
}
