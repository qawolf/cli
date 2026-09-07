import type { DeviceAuthorization } from "~/core/deviceAuth/types.js";
import { authMessages } from "~/core/messages/index.js";
import { sleep } from "~/core/sleep.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { openBrowser } from "~/shell/openBrowser.js";
import { defaultSpawn } from "~/shell/spawn.js";

export type ShowDeviceCodeDeps = {
  platform: NodeJS.Platform;
  openBrowser: (url: string) => Promise<boolean>;
};

export function defaultOpenBrowser(
  platform: NodeJS.Platform,
): (url: string) => Promise<boolean> {
  return (url) => openBrowser(url, { sleep, spawn: defaultSpawn, platform });
}

/** Shows the user code, opens the verification page, and says it is waiting. */
export async function showDeviceCode(
  ctx: CommandContext,
  authorization: DeviceAuthorization,
  deps: ShowDeviceCodeDeps,
): Promise<void> {
  const url =
    authorization.verificationUriComplete ?? authorization.verificationUri;
  ctx.ui.note(
    [
      authMessages.device.confirmCode(authorization.userCode),
      authMessages.device.visitUrl(url),
      url === authorization.verificationUri
        ? undefined
        : authMessages.device.visitUrlPlain(authorization.verificationUri),
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
    authMessages.title,
  );

  const opened = await deps.openBrowser(url);
  if (!opened) ctx.ui.info(authMessages.device.openFailed(url));

  ctx.ui.step(authMessages.device.waiting);
}
