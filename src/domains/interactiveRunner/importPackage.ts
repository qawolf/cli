import {
  publicContractsV1,
  runPackageJsonPath,
} from "@qawolf/api-contracts/v1";
import { join } from "node:path";

import { readNpmDependencies } from "~/core/interactiveRunner/npmDependencies.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const defaultPackageVersion = "latest";

/**
 * Installs one package into a runner's live run. The runner discards the
 * `package.json` a run shipped, so the request carries the project's
 * dependencies for the install to resolve against.
 */
export async function handleRunnerImportPackage(
  ctx: AuthCommandContext,
  options: {
    name: string;
    runner: string | undefined;
    version: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // A run ships this file unchanged, so reading it directly gives the same
  // content without walking the project for files this command never sends.
  const content = await deps
    .readFile(join(deps.cwd, runPackageJsonPath))
    .catch(() => undefined);
  if (content === undefined) {
    return {
      error: interactiveRunnerMessages.missingPackageJsonForImport,
      exitCode: exitCodes.config,
    };
  }
  const dependencies = readNpmDependencies(content);
  if (!dependencies.ok) {
    return {
      error: interactiveRunnerMessages.packageJsonUnreadable(
        dependencies.reason,
      ),
      exitCode: exitCodes.config,
    };
  }

  // Never launches: the install goes into a live run, which a fresh runner has
  // no way to have.
  const resolved = await resolveRunner(
    ctx,
    {
      autoLaunch: false,
      noRunnerIdMessage: interactiveRunnerMessages.noRunnerIdForImport,
      runner: options.runner,
    },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  const packageVersion = options.version ?? defaultPackageVersion;
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.importPackage,
    {
      id: resolved.runnerId,
      npmDependencies: dependencies.dependencies,
      packageName: options.name,
      packageVersion,
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    return {
      ...failureFields(result),
      exitCode: result.exitCode ?? exitCodes.network,
    };
  }

  if (result.value.outcome === "failure") {
    const failure = result.value;
    const { failureReason } = failure;
    switch (failureReason) {
      // npm's own refusal, so a name or a version to correct rather than retry.
      case "install-failed":
        return {
          error: interactiveRunnerMessages.installFailed(
            options.name,
            packageVersion,
            failure.errorMessage,
          ),
          exitCode: exitCodes.invalidArgs,
        };
      case "runner-unreachable":
        return {
          error: interactiveRunnerMessages.runnerUnreachable,
          exitCode: exitCodes.network,
        };
      default: {
        failureReason satisfies never;
        return {
          error: interactiveRunnerMessages.importAnsweredUnknown(failureReason),
          exitCode: exitCodes.network,
        };
      }
    }
  }

  ctx.ui.output(
    result.value,
    interactiveRunnerMessages.packageInstalled(options.name, packageVersion),
  );
  return undefined;
}
