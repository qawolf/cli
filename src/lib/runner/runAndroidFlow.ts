import { pathToFileURL } from "node:url";
import type {
  AndroidFlowApiReturnValue,
  AndroidFlowDefinition,
} from "@qawolf/flows/android";
import { createAndroidLaunchContext } from "~/launch/android/createAndroidLaunchContext.js";
import type {
  AndroidLaunchContext,
  AndroidLaunchDeps,
  AndroidLaunchOptions,
} from "~/launch/android/types.js";
import { createRunner } from "./createRunner.js";
import type {
  FlowDefinition,
  FlowDeps,
  FlowRunResult,
  RunnerDeps,
  RunnerOptions,
} from "./types.js";
import { FailWithoutRetryError } from "./errors.js";
import { notSupported } from "./runWebFlowUtils.js";
import {
  resolveAvdName,
  unsupportedAndroidDepNames,
} from "./runAndroidFlowUtils.js";

export type RunAndroidFlowDeps = RunnerDeps & AndroidLaunchDeps;

export type RunAndroidFlowOptions = RunnerOptions &
  Omit<AndroidLaunchOptions, "avdName"> & {
    /** Overrides the AVD name derived from the flow target. */
    avdName?: string;
  };

export async function runAndroidFlow({
  deps,
  options,
  flowPath,
}: {
  deps: RunAndroidFlowDeps;
  options: RunAndroidFlowOptions;
  flowPath: string;
}): Promise<FlowRunResult> {
  const mod = (await import(pathToFileURL(flowPath).href)) as Record<
    string,
    unknown
  >;
  const exported = mod["default"] as AndroidFlowApiReturnValue | undefined;
  if (exported === undefined) {
    throw new Error(`No default export found in "${flowPath}"`);
  }
  if (typeof exported === "function") {
    // (D2) Android legacy flows have no target; AVD derivation is impossible.
    throw new Error(
      "runAndroidFlow: legacy flow functions are not supported; use flow() from @qawolf/flows/android",
    );
  }

  const {
    name: flowName,
    run: runFn,
    target,
  } = exported as AndroidFlowDefinition;
  const avdName = options.avdName ?? resolveAvdName(target);

  const openCtxs: AndroidLaunchContext[] = [];
  let result: FlowRunResult | undefined;

  // Lazily creates a new context each time the flow calls wdio.startAndroid().
  const startAndroid = async (): Promise<unknown> => {
    const ctx = createAndroidLaunchContext({
      deps,
      options: {
        avdName,
        recordVideo: options.recordVideo,
        outputDir: options.outputDir,
      },
    });
    openCtxs.push(ctx);
    await ctx.launch();
    const driver = ctx.pages()[0];
    if (driver === undefined) {
      throw new Error(
        "Android launch context returned no driver after a successful launch",
      );
    }
    return driver;
  };

  const flowDef: FlowDefinition = {
    name: flowName,
    path: flowPath,
    callback: async (flowDeps: FlowDeps) => {
      const androidDeps: Record<string, unknown> = {
        ...Object.fromEntries(
          unsupportedAndroidDepNames.map((name) => [name, notSupported(name)]),
        ),
        inputs: flowDeps.flowInputs,
        workflowInputs: flowDeps.flowInputs,
        setOutput: flowDeps.setOutput,
        failWithoutRetry: () => {
          throw new FailWithoutRetryError("failWithoutRetry");
        },
        wdio: { startAndroid },
      };
      await runFn(androidDeps as unknown as Parameters<typeof runFn>[0]);
    },
  };

  const runner = createRunner({ deps, options });
  try {
    result = await runner.run(flowDef);
    return result;
  } finally {
    const passed = result?.passed ?? false;
    await Promise.allSettled(openCtxs.map((ctx) => ctx.cleanup(passed)));
  }
}
