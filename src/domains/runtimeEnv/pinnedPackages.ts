import {
  appiumVersion,
  emailsVersion,
  expectWebdriverioVersion,
  flowsVersion,
  playwrightVersion,
  testkitVersion,
  wdioGlobalsVersion,
  wdioLoggerVersion,
  webdriverioVersion,
} from "~/generated/dependencyVersions.js";

export type PinnedPackage = { name: string; version: string };

/** Canonical list of pinned runtime packages the CLI installs and resolves from. */
export const pinnedPackages: PinnedPackage[] = [
  { name: "@qawolf/flows", version: flowsVersion },
  { name: "playwright", version: playwrightVersion },
  { name: "@qawolf/emails", version: emailsVersion },
  { name: "@qawolf/testkit", version: testkitVersion },
  { name: "appium", version: appiumVersion },
  // Peer dep of @qawolf/flows ≥0.1.4 — configureFlowRuntime imports it, and
  // the --legacy-peer-deps install would otherwise never provide it.
  //
  // It must stay a devDependency of the CLI, never a dependency. expect-webdriverio
  // peer-requires @wdio/globals@^9, and @wdio/globals ≥9.31.0 peer-requires
  // expect-webdriverio@^6.0.5. A root-level pin of 5.6.5 therefore gives npm an
  // unsatisfiable peer cycle, and `npm i @qawolf/cli` backtracks through every
  // @wdio/globals 9.x release instead of failing fast — a 35+ minute CPU spin.
  // Installing it here keeps it out of the consumer's resolution, and this
  // managed install passes --legacy-peer-deps so the cycle is never explored.
  { name: "expect-webdriverio", version: expectWebdriverioVersion },
  // expect-webdriverio's own peers. The managed install passes --legacy-peer-deps,
  // which skips peers entirely, so without these `import("expect-webdriverio")`
  // throws ERR_MODULE_NOT_FOUND on @wdio/logger and every mobile flow dies inside
  // configureFlowRuntime → initializeMobileExpect. They carry the same
  // devDependency-only rule as expect-webdriverio above.
  { name: "webdriverio", version: webdriverioVersion },
  { name: "@wdio/globals", version: wdioGlobalsVersion },
  { name: "@wdio/logger", version: wdioLoggerVersion },
];
