import { formatSeconds } from "~/core/formatSeconds.js";

// Most platform reasons already end with a period.
const withoutPeriod = (reason: string) => reason.replace(/\.$/, "");

export const buildMessages = {
  createFailed: (buildId: string, reason: string) =>
    `The file is uploaded as build ${buildId}, but the build could not be created: ${withoutPeriod(reason)}. If the cause was temporary, finish it with qawolf build create --build-id ${buildId} and the same environment, branch and commit flags.`,
  fileUnreadable: (path: string) => `${path} is not a readable file.`,
  storageRefused: (status: number) => `storage refused it (HTTP ${status})`,
  storageTimedOut: (timeoutMs: number) =>
    `it did not finish within ${formatSeconds(timeoutMs)}`,
  storageUnreachable: (cause: string | undefined) =>
    `could not reach storage${cause === undefined ? "" : ` (${cause})`}`,
  uploaded: (build: {
    appId: string;
    id: string;
    platform: string;
    url: string;
    version?: string | undefined;
  }) =>
    `Build ${build.id} (${build.appId}, ${build.platform}${build.version === undefined ? "" : ` ${build.version}`}) uploaded: ${build.url}`,
  uploadFailed: (buildId: string, reason: string) =>
    `The upload of build ${buildId} failed: ${reason}. Run qawolf build upload again: it creates a new build.`,
  uploading: (fileName: string, sizeBytes: number) =>
    `Uploading ${fileName} (${sizeBytes} bytes)`,
};
