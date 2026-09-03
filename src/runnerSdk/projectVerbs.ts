import {
  publicContractsV1,
  runPackageJsonPath,
} from "@qawolf/api-contracts/v1";
import { join } from "node:path";

import { readNpmDependencies } from "~/core/interactiveRunner/npmDependencies.js";
import { runnerCallOptions } from "~/domains/interactiveRunner/runnerCallOptions.js";
import { resolveSnippetScope } from "~/domains/interactiveRunner/snippetScope.js";

import type { SdkContext } from "./createContext.js";
import { toSdkResult } from "./toSdkResult.js";
import type {
  EvaluateSnippetRequest,
  EvaluatedSnippet,
  ImportPackageRequest,
  ImportedPackage,
  SdkResult,
} from "./types.js";

const { evaluateSnippet, importPackage } = publicContractsV1.runner;

export function createProjectVerbs({ deps, platformClient }: SdkContext) {
  return {
    async evaluateSnippet({
      runnerId,
      scope,
      source,
    }: EvaluateSnippetRequest): Promise<SdkResult<EvaluatedSnippet>> {
      const resolved = await resolveSnippetScope(
        scope === "no-imports" ? undefined : scope.filePath,
        deps,
      );
      if (!resolved.ok) return { error: resolved.error, ok: false };

      return toSdkResult(
        await platformClient.callPublicApi(
          evaluateSnippet,
          {
            code: source,
            id: runnerId,
            ...(resolved.filePath === undefined
              ? {}
              : { filePath: resolved.filePath }),
            ...(resolved.files === undefined ? {} : { files: resolved.files }),
          },
          runnerCallOptions,
        ),
      );
    },

    async importPackage({
      name,
      runnerId,
      version,
    }: ImportPackageRequest): Promise<SdkResult<ImportedPackage>> {
      const content = await deps
        .readFile(join(deps.cwd, runPackageJsonPath))
        .catch(() => undefined);
      if (content === undefined) {
        return {
          error: `No ${runPackageJsonPath} to install into.`,
          ok: false,
        };
      }
      const dependencies = readNpmDependencies(content);
      if (!dependencies.ok) {
        return {
          error: `${runPackageJsonPath} could not be read: ${dependencies.reason}.`,
          ok: false,
        };
      }

      return toSdkResult(
        await platformClient.callPublicApi(
          importPackage,
          {
            id: runnerId,
            npmDependencies: dependencies.dependencies,
            packageName: name,
            packageVersion: version === "latest" ? "latest" : version.exact,
          },
          runnerCallOptions,
        ),
      );
    },
  };
}
