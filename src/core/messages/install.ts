export const installMessages = {
  noFlowsFound: "No flows requiring installation were found.",
  iosNotSupported: "iOS targets are not supported in v0.1.",
  installComplete: "Install complete.",
  noBrowserFlows: "No web flows requiring browser installation were found.",
  androidSdkNotFound:
    "Android SDK not found. Set ANDROID_HOME to the SDK path.\n" +
    "Install Android Studio and open Tools > SDK Manager to install the SDK.",
  android: {
    noFlowsFound: "No Android flows found. Nothing to install.",
    licensesAlreadyAccepted: "Android SDK licenses already accepted.",
    acceptingLicenses: "Accepting Android SDK licenses",
    uiautomator2AlreadyInstalled: "uiautomator2 driver already installed.",
    installingUiautomator2: "Installing uiautomator2 driver",
  },
} as const;
