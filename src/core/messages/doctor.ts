import { toolNotInstalled, toolNotRunnable } from "./toolNotFound.js";

export const doctorMessages = {
  intro: "qawolf doctor",
  agentLine: (
    status: string,
    name: string,
    version: string | undefined,
    detail: string | undefined,
  ) => {
    const base = version ? `${name}  ${version}` : name;
    const tail = detail ? `: ${detail}` : "";
    return `${status.toUpperCase()} ${base}${tail}`;
  },
  humanLine: (
    name: string,
    version: string | undefined,
    detail: string | undefined,
  ) => {
    const base = version ? `${name}  ${version}` : name;
    return detail ? `${base}: ${detail}` : base;
  },
  nodeVersion: {
    couldNotParseEngines: (engines: string) =>
      `Could not parse engines.node "${engines}"`,
    couldNotParseVersion: (version: string) =>
      `Could not parse Node version "${version}"`,
    belowRequired: (actual: string, required: string) =>
      `Node ${actual} is below required ${required}`,
  },
  androidSdk: {
    homeNotSet:
      "ANDROID_HOME (or ANDROID_SDK_ROOT) is not set. Install Android Studio and set ANDROID_HOME to the SDK path.",
    homeDoesNotExist: (path: string) => `${path} does not exist`,
    adbLaunchFailed: (bin: string, detail: string) =>
      `Could not launch adb at ${bin} (${detail}). Install Android SDK platform-tools or check the path.`,
    emulatorLaunchFailed: (bin: string, detail: string) =>
      `Could not launch emulator at ${bin} (${detail}). Install the Android SDK emulator package or check the path.`,
    emulatorAvdListFailed: (bin: string, detail: string) =>
      `Could not launch emulator at ${bin} to list AVDs (${detail}).`,
    avdListFailed: (detail: string) => `Could not list AVDs (${detail}).`,
    missingAvds: (avds: string) =>
      `Missing AVD(s): ${avds}. Run \`qawolf install android\`.`,
  },
  apiKey: {
    notFound:
      "No API key found. Set QAWOLF_API_KEY or run `qawolf auth login`.",
  },
  apiUrl: {
    unreachable: (url: string, detail: string) =>
      `${url} unreachable: ${detail}`,
    badStatus: (url: string, status: number) => `${url} returned ${status}`,
  },
  npmRegistry: {
    notInstalled: "npm is not installed or not on PATH",
  },
  playwright: {
    notFound: (path?: string) => toolNotInstalled("Playwright", path),
    launchFailed:
      "Could not launch Playwright. Try reinstalling the qawolf CLI.",
    versionUnparseable: "Could not parse playwright version output",
  },
  appium: {
    notFound: (path?: string) => toolNotInstalled("Appium", path),
    driverListFailed: (detail: string) =>
      toolNotRunnable("Could not run `appium driver list`", detail),
    cannotCheckDriverList: "Cannot check driver list without Appium binary.",
    uiautomator2NotInstalled:
      "uiautomator2 driver not installed. Run `qawolf install android` to install it.",
  },
  fileAssets: {
    uncategorizedVar: (varName: string) =>
      `uncategorized file-asset var: ${varName}`,
    unreadable: (file: string, message: string) =>
      `${file} could not be read: ${message}`,
    referencesVars: (file: string, vars: string, reason: string) =>
      `${file} references ${vars} — ${reason}`,
    warnReasons: {
      "file-asset":
        "file assets aren't pulled in v0.1; this flow can't run locally",
      "mobile-input":
        "mobile build inputs aren't mounted locally; provide the APK path via a local env var",
    } as const,
  },
} as const;
