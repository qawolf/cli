import type { AndroidFlowTargetInput } from "@qawolf/flows/android";
import type {
  AndroidExecutionTarget,
  ExecutionTargetOutput,
} from "@qawolf/flow-targets";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import { makeAvdName } from "~/core/androidTargets.js";
import { errorMessage } from "~/core/errors.js";
import { runnerMessages } from "~/core/messages/index.js";
import type { Logger } from "~/shell/logger.js";
import { initFlowRuntime } from "./initFlowRuntime.js";
import { unsupportedSharedDepNames } from "./unsupportedDepNames.js";

// Matches testContextDependencies from @qawolf/flows/android minus wdio,
// which is provided by the runner.
export const unsupportedAndroidDepNames = [
  "emulator",
  ...unsupportedSharedDepNames,
] as const;

// Cast matches the pattern in src/commands/flows/expand.ts — parseExecutionTarget
// validates at runtime via Zod and throws on invalid input.
type ParseArg = Parameters<typeof parseExecutionTarget>[0];

// Unwraps option-wrapped targets: { target, launch? } → AndroidFlowTarget
function unwrapTarget(targetInput: AndroidFlowTargetInput) {
  return typeof targetInput === "object" && "target" in targetInput
    ? targetInput.target
    : targetInput;
}

/** Parses an Android flow's target input into its execution target. */
function resolveAndroidExecutionTarget(
  targetInput: AndroidFlowTargetInput,
): ExecutionTargetOutput {
  const parsed = parseExecutionTarget(unwrapTarget(targetInput) as ParseArg);
  if (parsed.platform !== "android") {
    throw new Error(
      `runAndroidFlow: expected an Android target, got platform "${parsed.platform}"`,
    );
  }
  return parsed;
}

export function resolveAvdName(targetInput: AndroidFlowTargetInput): string {
  const raw = unwrapTarget(targetInput);

  if (typeof raw !== "string") {
    const { deviceModel, androidVersion } = raw.meta;
    return makeAvdName(deviceModel, androidVersion);
  }

  // Preset literal string — parse via @qawolf/flow-targets
  const parsed = resolveAndroidExecutionTarget(raw);
  // parsed is ExecutionTargetOutput; cast through unknown for the input-schema type.
  const { deviceModel, androidVersion } = (
    parsed as unknown as AndroidExecutionTarget
  ).meta;
  return makeAvdName(deviceModel, androidVersion);
}

/**
 * Configures @qawolf/flows with the flow's own Android target, so it
 * initializes the mobile `expect` that the flow imports. A failure only logs a
 * warning: a flow that does not call `expect` can still pass.
 */
export async function configureAndroidFlowRuntime({
  flowPath,
  target,
  timeout,
  deps,
}: {
  flowPath: string;
  target: AndroidFlowTargetInput;
  timeout: number;
  deps: { readonly depsRoot: string; readonly logger?: Logger };
}): Promise<void> {
  try {
    await initFlowRuntime(flowPath, {
      timeout,
      target: resolveAndroidExecutionTarget(target),
      depsRoot: deps.depsRoot,
    });
  } catch (err) {
    deps.logger?.warn(runnerMessages.mobileExpectInitFailed(errorMessage(err)));
  }
}
