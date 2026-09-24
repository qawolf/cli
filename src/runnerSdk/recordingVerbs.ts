import {
  recordOnRunner,
  readRunnerRecordings,
} from "~/domains/interactiveRunner/recordingRequests.js";

import type { SdkContext } from "./createContext.js";
import { givenRunner } from "./givenRunner.js";
import { toSdkResult } from "./toSdkResult.js";
import type {
  RecordRequest,
  RecordResponse,
  RecordingsRequest,
  Recordings,
  SdkResult,
} from "./types.js";

export function createRecordingVerbs(context: SdkContext) {
  return {
    async record({
      runnerId,
      command,
    }: RecordRequest): Promise<SdkResult<RecordResponse>> {
      return toSdkResult(
        await recordOnRunner(context, givenRunner(runnerId), command),
      );
    },

    async listRecordings({
      runnerId,
      recordingId,
      pageToken,
    }: RecordingsRequest): Promise<SdkResult<Recordings>> {
      return toSdkResult(
        await readRunnerRecordings(context, givenRunner(runnerId), {
          ...(recordingId === undefined ? {} : { recordingId }),
          ...(pageToken === undefined ? {} : { pageToken }),
        }),
      );
    },
  };
}
