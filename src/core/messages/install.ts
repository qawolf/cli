import { pluralize } from "~/core/pluralize.js";

export const installMessages = {
  noFlowsFound: "No flows requiring installation were found.",
  iosNotSupported: "iOS targets are not supported in v0.1.",
  installComplete: "Install complete.",
  noBrowserFlows: "No web flows requiring browser installation were found.",
  androidSdkNotFound:
    "Android SDK not found. Set ANDROID_HOME to the SDK path.\n" +
    "Install Android Studio and open Tools > SDK Manager to install the SDK.",
  installingBrowser: (browser: string) => `Install ${browser}`,
  browsersInstalled: (count: number) =>
    `Installed ${pluralize(count, "browser")}.`,
  playwrightInstallFailed: (browser: string, detail: string) =>
    `playwright install ${browser} failed: ${detail}`,
  playwrightInstallLaunchFailed: (browser: string) =>
    `playwright install ${browser} failed: process failed to launch`,
  clear: {
    title: "Clear runtime cache",
    locationLabel: "Location",
    confirmPrompt: "Remove the managed runtime cache?",
    cancelled: "Clear cancelled.",
    cleared: (dir: string) => `Removed managed runtime cache at ${dir}.`,
    nothingToClear: (dir: string) =>
      `No managed runtime cache found at ${dir}.`,
  },
  android: {
    noFlowsFound: "No Android flows found. Nothing to install.",
    licensesAlreadyAccepted: "Android SDK licenses already accepted.",
    acceptingLicenses: "Accepting Android SDK licenses",
    uiautomator2AlreadyInstalled: "uiautomator2 driver already installed.",
    installingUiautomator2: "Installing uiautomator2 driver",
    sdkmanagerNotFound: (sdkManagerPath: string) =>
      `sdkmanager not found at ${sdkManagerPath}.\n` +
      `Install Android cmdline-tools via Android Studio SDK Manager or from\n` +
      `https://developer.android.com/studio#command-line-tools-only`,
    systemImageAlreadyInstalled: (systemImage: string) =>
      `System image ${systemImage} already installed.`,
    installingSystemImage: (systemImage: string) => `Installing ${systemImage}`,
    sdkmanagerInstallFailed: (systemImage: string, detail: string) =>
      `sdkmanager failed to install ${systemImage}: ${detail}`,
    avdAlreadyExists: (avdName: string) =>
      `AVD ${avdName} already exists, skipping.`,
    creatingAvd: (avdName: string) => `Creating AVD ${avdName}`,
    avdmanagerCreateFailed: (avdName: string, detail: string) =>
      `avdmanager failed to create ${avdName}: ${detail}`,
    uiautomator2InstallFailed: (detail: string) =>
      `appium driver install uiautomator2 failed: ${detail}`,
  },
} as const;
