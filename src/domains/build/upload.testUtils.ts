import { mock } from "bun:test";

import type { BuildUploadDeps, BuildUploadOptions } from "./upload.js";

export const buildId = "abcdefghijklmnopqrstuvwxobld";

export const baseOptions: BuildUploadOptions = {
  branch: undefined,
  commitSha: undefined,
  environmentBaseEphemeralEnvironment: undefined,
  environmentEphemeral: undefined,
  environmentId: undefined,
  environmentName: undefined,
  filePath: "dist/app-release.apk",
  workspaceId: undefined,
};

export const requested = {
  ok: true,
  value: {
    buildId,
    expiresAt: "2026-10-26T13:00:00.000Z",
    uploadHeaders: { "x-goog-if-generation-match": "0" },
    uploadUrl: "https://storage.example/app-release.apk?sig=1",
  },
} as const;

export const created = {
  ok: true,
  value: {
    build: {
      appId: "com.example.app",
      createdAt: "2026-10-26T12:00:00.000Z",
      fileName: "app-release.apk",
      id: buildId,
      platform: "android",
      url: "https://app.qawolf.com/acme/builds",
      version: "1.2.3",
    },
  },
} as const;

export function makeDeps(
  file: Blob | "unreadable" = new Blob(["apk bytes"]),
): BuildUploadDeps & {
  putFile: ReturnType<typeof mock<BuildUploadDeps["putFile"]>>;
} {
  return {
    openFile: () => Promise.resolve(file === "unreadable" ? undefined : file),
    putFile: mock<BuildUploadDeps["putFile"]>().mockResolvedValue({
      ok: true,
      data: undefined,
    }),
  };
}
