import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import {
  type BuildUploadOptions,
  handleBuildUpload,
} from "~/domains/build/upload.js";
import { openFileAsBlob, putSignedUrl } from "~/shell/platform/putSignedUrl.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

const uploadExamples = `
Examples:
  $ qawolf build upload app-release.apk
  $ qawolf build upload App.ipa --environment-id <id>
  $ qawolf build upload my-app_1.0.0_amd64.deb --environment-id <id>
  $ qawolf build upload app-release.aab --environment-name pr-42 --environment-ephemeral --environment-base-ephemeral-environment staging --branch feat/login --commit-sha 1a2b3c4

Without an environment flag, the build belongs to no environment: only a run
created with it installs it.`;

export type UploadFlags = {
  branch?: string;
  commitSha?: string;
  environmentBaseEphemeralEnvironment?: string;
  environmentEphemeral?: boolean;
  environmentId?: string;
  environmentName?: string;
  workspaceId?: string;
};

export const toUploadOptions = (
  filePath: string,
  opts: UploadFlags,
): BuildUploadOptions => ({
  branch: opts.branch,
  commitSha: opts.commitSha,
  environmentBaseEphemeralEnvironment: opts.environmentBaseEphemeralEnvironment,
  environmentEphemeral: opts.environmentEphemeral,
  environmentId: opts.environmentId,
  environmentName: opts.environmentName,
  filePath,
  workspaceId: opts.workspaceId,
});

export function registerBuildUploadCommand(
  build: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(build.command("upload <file>"), "write")
    .description(
      "Upload an app file (.apk, .aab, .ipa, or a Linux Electron .deb or .rpm, up to 500 MB) and create a build from it. Runs build requestUpload, the PUT and build create in one step",
    )
    .option(
      "--environment-id <id>",
      "Put the build on this existing environment: its runs install it from now on, until a newer build of the same app and platform arrives",
    )
    .option(
      "--environment-name <name>",
      "Put the build on the environment with this alias or name, and create the environment when none matches",
    )
    .option(
      "--environment-ephemeral",
      "With --environment-name, create an ephemeral environment when the name creates one, such as a pull request's",
    )
    .option(
      "--environment-base-ephemeral-environment <name>",
      "With --environment-ephemeral, the alias or name of the environment a created ephemeral environment copies from",
    )
    .option("--branch <branch>", "The branch the build came from")
    .option("--commit-sha <sha>", "The commit the build came from")
    .option(
      "--workspace-id <id>",
      "The workspace to upload into. Required when authenticating with an organization or user API key",
    )
    .addHelpText("after", uploadExamples)
    .action((filePath: string, opts: UploadFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleBuildUpload(ctx, toUploadOptions(filePath, opts), {
          openFile: (path) => openFileAsBlob(ctx.fs, path),
          putFile: (args) => putSignedUrl(args),
        }),
      )(opts, command),
    );
}
