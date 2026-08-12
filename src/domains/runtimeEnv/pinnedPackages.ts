import {
  appiumUiautomator2DriverVersion,
  appiumVersion,
  emailsVersion,
  expectWebdriverioVersion,
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
  {
    name: "appium-uiautomator2-driver",
    version: appiumUiautomator2DriverVersion,
  },
  // Peer dep of @qawolf/flows ≥0.1.4 — configureFlowRuntime imports it, and
  // the --legacy-peer-deps install would otherwise never provide it.
  { name: "expect-webdriverio", version: expectWebdriverioVersion },
];
