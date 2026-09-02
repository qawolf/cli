import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { runnerCallOptions } from "~/domains/interactiveRunner/runnerCallOptions.js";

import type { SdkContext } from "./createContext.js";
import { toSdkResult } from "./toSdkResult.js";
import type {
  ActRequest,
  HighlightSelectorRequest,
  HighlightedSelector,
  InspectRequest,
  Inspected,
  PerformedAction,
  PromoteSnapshotRequest,
  PromotedSnapshot,
  RunnerRequest,
  Screenshot,
  SdkResult,
} from "./types.js";

const {
  highlightSelector,
  inspect,
  performAction,
  promoteSnapshot,
  takeScreenshot,
} = publicContractsV1.runner;

export function createPageVerbs({ platformClient }: SdkContext) {
  return {
    async act({
      action,
      runnerId,
    }: ActRequest): Promise<SdkResult<PerformedAction>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          performAction,
          { action, id: runnerId },
          runnerCallOptions,
        ),
      );
    },

    async highlightSelector({
      highlight,
      runnerId,
    }: HighlightSelectorRequest): Promise<SdkResult<HighlightedSelector>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          highlightSelector,
          {
            id: runnerId,
            selector: highlight === "clear" ? "" : highlight.selector,
          },
          runnerCallOptions,
        ),
      );
    },

    async inspect({
      request,
      runnerId,
    }: InspectRequest): Promise<SdkResult<Inspected>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          inspect,
          { id: runnerId, request },
          runnerCallOptions,
        ),
      );
    },

    async promoteSnapshot({
      baselinePath,
      runnerId,
      screenshotPath,
    }: PromoteSnapshotRequest): Promise<SdkResult<PromotedSnapshot>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          promoteSnapshot,
          { baselinePath, id: runnerId, screenshotPath },
          runnerCallOptions,
        ),
      );
    },

    async screenshot({
      runnerId,
    }: RunnerRequest): Promise<SdkResult<Screenshot>> {
      return toSdkResult(
        await platformClient.callPublicApi(
          takeScreenshot,
          { id: runnerId },
          runnerCallOptions,
        ),
      );
    },
  };
}
