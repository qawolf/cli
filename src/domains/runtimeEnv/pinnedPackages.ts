import {
  appiumUiautomator2DriverVersion,
  appiumVersion,
  appiumXcuitestDriverVersion,
  emailsVersion,
  flowsVersion,
  playwrightVersion,
  testkitVersion,
} from "~/generated/dependencyVersions.js";

export type PinnedPackage = { name: string; version: string };

/** Canonical list of pinned runtime packages the CLI installs and resolves from. */
export const pinnedPackages: PinnedPackage[] = [
  { name: "@qawolf/flows", version: flowsVersion },
  { name: "playwright", version: playwrightVersion },
  { name: "@qawolf/emails", version: emailsVersion },
  { name: "@qawolf/testkit", version: testkitVersion },
  { name: "appium", version: appiumVersion },
  { name: "appium-xcuitest-driver", version: appiumXcuitestDriverVersion },
  {
    name: "appium-uiautomator2-driver",
    version: appiumUiautomator2DriverVersion,
  },
];
