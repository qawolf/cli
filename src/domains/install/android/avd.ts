import { join } from "node:path";
import type { CommandContext } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { installMessages } from "~/core/messages/index.js";

export type AvdSpec = {
  readonly avdName: string;
  readonly systemImage: string;
  readonly deviceId: string;
};

export type InstallAvdsDeps = {
  readonly spawn: SpawnFn;
  readonly sdkManagerPath: string;
  readonly avdManagerPath: string;
  readonly androidHome: string;
  readonly checkExists: (path: string) => boolean;
  /** Must match the platform that resolved sdkManagerPath and avdManagerPath. */
  readonly platform: NodeJS.Platform;
};

export async function installAvds(
  ctx: CommandContext,
  specs: readonly AvdSpec[],
  deps: InstallAvdsDeps,
): Promise<void> {
  // Verify sdkmanager is reachable before doing any work.
  const versionResult = await deps.spawn(deps.sdkManagerPath, ["--version"], {
    platform: deps.platform,
  });
  if (versionResult.exitCode !== 0) {
    throw new Error(
      installMessages.android.sdkmanagerNotFound(deps.sdkManagerPath),
    );
  }

  // Accept SDK licenses. Skipped when the license file already exists —
  // sdkmanager writes it on first acceptance.
  const licenseFile = join(deps.androidHome, "licenses", "android-sdk-license");
  if (deps.checkExists(licenseFile)) {
    ctx.ui.info(installMessages.android.licensesAlreadyAccepted);
  } else {
    ctx.ui.step(installMessages.android.acceptingLicenses);
    await deps.spawn(deps.sdkManagerPath, ["--licenses"], {
      stdin: "y\n".repeat(20),
      platform: deps.platform,
    });
  }

  // Install each unique system image. Check for system.img inside the directory
  // rather than the directory itself — sdkmanager can leave a partial install
  // (directory present, system.img absent) that avdmanager rejects.
  const installedImages = new Set<string>();
  for (const spec of specs) {
    if (installedImages.has(spec.systemImage)) continue;
    // system-images;android-35;google_apis_playstore;arm64-v8a
    //   → $ANDROID_HOME/system-images/android-35/google_apis_playstore/arm64-v8a/system.img
    const systemImg = join(
      deps.androidHome,
      ...spec.systemImage.split(";"),
      "system.img",
    );
    if (deps.checkExists(systemImg)) {
      ctx.ui.info(
        installMessages.android.systemImageAlreadyInstalled(spec.systemImage),
      );
      installedImages.add(spec.systemImage);
      continue;
    }
    ctx.ui.step(
      installMessages.android.installingSystemImage(spec.systemImage),
    );
    const result = await deps.spawn(deps.sdkManagerPath, [spec.systemImage], {
      platform: deps.platform,
    });
    if (result.exitCode !== 0) {
      const detail =
        (result.stderr || result.stdout)
          .split("\n")
          .map((l) => l.trim())
          .find(Boolean) ?? `exit code ${result.exitCode}`;
      throw new Error(
        installMessages.android.sdkmanagerInstallFailed(
          spec.systemImage,
          detail,
        ),
      );
    }
    installedImages.add(spec.systemImage);
  }

  // List existing AVDs to skip creation when already present.
  const listResult = await deps.spawn(
    deps.avdManagerPath,
    ["list", "avd", "-c"],
    { platform: deps.platform },
  );
  const existingAvds = new Set(
    listResult.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  // Create missing AVDs.
  for (const spec of specs) {
    if (existingAvds.has(spec.avdName)) {
      ctx.ui.info(installMessages.android.avdAlreadyExists(spec.avdName));
      continue;
    }
    ctx.ui.step(installMessages.android.creatingAvd(spec.avdName));
    const result = await deps.spawn(
      deps.avdManagerPath,
      [
        "create",
        "avd",
        "-n",
        spec.avdName,
        "-k",
        spec.systemImage,
        "-d",
        spec.deviceId,
        "--force",
      ],
      { platform: deps.platform },
    );
    if (result.exitCode !== 0) {
      const detail =
        (result.stderr || result.stdout)
          .split("\n")
          .map((l) => l.trim())
          .find(Boolean) ?? `exit code ${result.exitCode}`;
      throw new Error(
        installMessages.android.avdmanagerCreateFailed(spec.avdName, detail),
      );
    }
  }
}
