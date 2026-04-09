import {
  type SaveApiKeyResult,
  resolveApiKey,
  saveApiKey,
  validateApiKey,
} from "../../lib/auth/index.js";
import { authCopy } from "../../lib/copy/index.js";
import { errorMessage } from "../../lib/errors.js";
import type { UIContext } from "../../lib/ui/index.js";

export async function handleLogin(
  ui: UIContext,
  configDir: string,
): Promise<void> {
  const existing = await resolveApiKey(configDir);
  if (existing) {
    ui.info(authCopy.alreadyConfigured);
    return;
  }

  ui.gap();
  ui.intro(authCopy.introTitle);

  const result = await ui.password(authCopy.promptApiKey);
  if (!result.ok) {
    ui.cancel(authCopy.cancelled);
    return;
  }

  let saveResult: SaveApiKeyResult | undefined;

  try {
    await ui.withProgress(
      [
        {
          message: authCopy.verifying,
          task: async () => {
            const v = await validateApiKey(result.value);
            if (!v.valid) throw new Error(authCopy.validationFailed);
          },
        },
        {
          message: authCopy.storing,
          task: async () => {
            saveResult = await saveApiKey(configDir, result.value);
          },
        },
      ],
      () => {
        return saveResult?.stored === "file"
          ? authCopy.storedFile
          : authCopy.storedKeychain;
      },
    );
  } catch (err: unknown) {
    ui.error(errorMessage(err));
    process.exitCode = 1;
    return;
  }

  ui.outro(authCopy.outroSuccess);
}
