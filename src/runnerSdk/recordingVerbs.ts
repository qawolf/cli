import {
  recordOnRunner,
  readRunnerRecordings,
} from "~/domains/interactiveRunner/recordingRequests.js";

import type { SdkContext } from "./createContext.js";
import { givenRunner } from "./givenRunner.js";
import { toSdkResult } from "./toSdkResult.js";
import type {
  RecordRequest,
  Recorded,
  RecordingsRequest,
  Recordings,
  SdkResult,
} from "./types.js";

export function createRecordingVerbs(context: SdkContext) {
  return {
    async record({
      runnerId,
      command,
    }: RecordRequest): Promise<SdkResult<Recorded>> {
      return toSdkResult(
        await recordOnRunner(context, givenRunner(runnerId), command),
      );
    },

    async recordings({
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
