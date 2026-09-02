import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { runnerCallOptions } from "~/domains/interactiveRunner/runnerCallOptions.js";

import type { SdkContext } from "./createContext.js";
import { toSdkResult } from "./toSdkResult.js";
import type {
  KeptAlive,
  LaunchRequest,
  LaunchedRunner,
  RunnerRequest,
  SdkResult,
  StoppedRun,
  TerminatedRunner,
} from "./types.js";

const { launch, readJournal, stopRun, terminate } = publicContractsV1.runner;

export function createLifecycleVerbs({ platformClient }: SdkContext) {
  return {
    async keepalive({
      runnerId,
    }: RunnerRequest): Promise<SdkResult<KeptAlive>> {
      const read = await platformClient.callPublicApi(
        readJournal,
        { id: runnerId, stream: "run-status", tail: 1 },
        runnerCallOptions,
      );
      return read.ok
        ? { ok: true, value: { id: runnerId } }
        : { error: read.error, ok: false };
    },

    async launch({
      id,
      runnerFamily,
    }: LaunchRequest): Promise<SdkResult<LaunchedRunner>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          launch,
          {
            id,
            ...(runnerFamily === "default"
              ? {}
              : { runnerName: runnerFamily.name }),
          },
          runnerCallOptions,
        ),
      );
    },

    async stopRun({ runnerId }: RunnerRequest): Promise<SdkResult<StoppedRun>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          stopRun,
          { id: runnerId },
          runnerCallOptions,
        ),
      );
    },

    async terminate({
      runnerId,
    }: RunnerRequest): Promise<SdkResult<TerminatedRunner>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          terminate,
          { id: runnerId },
          runnerCallOptions,
        ),
      );
    },
  };
}
