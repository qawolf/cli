import type { AndroidFlowTargetInput } from "@qawolf/flows/android";
import type { AndroidExecutionTarget } from "@qawolf/flow-targets";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import { makeAvdName } from "~/core/androidTargets.js";

// Matches testContextDependencies from @qawolf/flows/android minus wdio,
// which is provided by the runner.
export const unsupportedAndroidDepNames = [
  "emulator",
  "fetchLatestEnvironmentVariables",
  "getInbox",
  "getOTP",
  "mountCifsShare",
  "OTPAuth",
  "qawolf",
  "runCommand",
  "setEnvironmentVariable",
  "startOpenVpn",
  "startWireGuard",
] as const;

// Cast matches the pattern in src/commands/flows/expand.ts — parseExecutionTarget
// validates at runtime via Zod and throws on invalid input.
type ParseArg = Parameters<typeof parseExecutionTarget>[0];

export function resolveAvdName(targetInput: AndroidFlowTargetInput): string {
  // Unwrap option-wrapped targets: { target, launch? } → AndroidFlowTarget
  const raw =
    typeof targetInput === "object" && "target" in targetInput
      ? targetInput.target
      : targetInput;

  if (typeof raw !== "string") {
    const { deviceModel, androidVersion } = raw.meta;
    return makeAvdName(deviceModel, androidVersion);
  }

  // Preset literal string — parse via @qawolf/flow-targets
  const parsed = parseExecutionTarget(raw as ParseArg);
  if (parsed.platform !== "android") {
    throw new Error(
      `runAndroidFlow: expected an Android target, got platform "${parsed.platform}"`,
    );
  }
  // parsed is ExecutionTargetOutput; cast through unknown for the input-schema type.
  const { deviceModel, androidVersion } = (
    parsed as unknown as AndroidExecutionTarget
  ).meta;
  return makeAvdName(deviceModel, androidVersion);
}
