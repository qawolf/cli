// Both end the line with no period: a terminal that linkifies takes the period
// as part of the address.
//
// A runner's screen plays only for the QA Wolf user that launched it, and an
// API key may be a team key, whose runner belongs to the team's automation user
// and refuses every person. So only a browser sign-in is promised the screen;
// with a key, the page is offered and it explains itself.
const pageAt = (url: string, canWatch: boolean) =>
  canWatch ? `Watch its screen at ${url}` : `Its runner page is at ${url}`;

const noRunnerId =
  "No runner id. Pass --runner, set QAWOLF_RUNNER_ID, or run qawolf runner launch first.";

export const lifecycleMessages = {
  alreadyRunning: (id: string, url: string, canWatch: boolean) =>
    `Runner ${id} was already running. ${pageAt(url, canWatch)}`,
  defaultNotRemembered: (id: string) =>
    `Runner ${id} could not be written to .qawolf as this directory's default, so later commands will not find it on their own. Pass --runner ${id}, or set QAWOLF_RUNNER_ID=${id}.`,
  defaultNotForgotten: (id: string) =>
    `Runner ${id} was terminated, but it could not be removed from .qawolf as this directory's default, so later commands will still be sent to it. Pass --runner, or launch a new runner.`,
  envRunnerIdShadowsLaunch: (launchedId: string, envId: string) =>
    `QAWOLF_RUNNER_ID=${envId} is still set, so commands that omit --runner will keep targeting it instead of the runner just launched. Pass --runner ${launchedId} to address this one.`,
  keptAlive: (id: string) =>
    `Runner ${id} is alive, and its inactivity clock has been reset.`,
  launchFailed: (id: string, error: string) =>
    `Launching runner ${id} failed. ${error}`,
  launchLost: (id: string, error: string) =>
    `Launching runner ${id} failed. ${error}. The request may still have reached QA Wolf and started a runner, so relaunch the same id with qawolf runner launch --id ${id} to attach to it rather than start a second one, or terminate it with qawolf runner terminate --runner ${id}.`,
  launched: (id: string, url: string, canWatch: boolean) =>
    `Launched runner ${id}. ${pageAt(url, canWatch)}`,
  launchedForCommand: (id: string, url: string, canWatch: boolean) =>
    `No runner was given, so launched ${id} for this command. Its browser is fresh: nothing has been run on it and nothing is signed in. It bills until it is terminated or idles out, so terminate it with qawolf runner terminate --runner ${id} when you are done. ${pageAt(url, canWatch)}`,
  noRunnerIdForImport: `${noRunnerId} An install also needs a live run to go into, which a runner gets from qawolf runner run.`,
  noRunnerIdForHighlight: `${noRunnerId} Highlighting also needs a live page to draw on, which a runner gets from its first run: run a flow on it with qawolf runner run.`,
  noRunnerIdForInspect: `${noRunnerId} Inspecting also needs a page, which a runner gets from its first run: run a flow on it with qawolf runner run.`,
  noRunnerIdForPromoteSnapshot: `${noRunnerId} A baseline is replaced on the runner that produced the screenshot, so it has to be the runner the diff came from.`,
  noRunnerIdForScreenshot: `${noRunnerId} A screenshot also needs a screen, which a runner gets from its first run: run a flow on it with qawolf runner run.`,
  noRunnerId,
  wasNotRunning: (id: string) => `Runner ${id} was not running.`,
  terminated: (id: string) => `Terminated runner ${id}.`,
  runStopped: (id: string) =>
    `Stopped the run on runner ${id}. The runner is still up, on whatever page the run reached.`,
  nothingToStop: (id: string) =>
    `Runner ${id} had nothing to stop. The run had already finished, or none had been submitted.`,
  runnerUnreachable:
    "The runner could not be reached. It may still be starting, or it may have terminated after inactivity. Retry, or launch it again.",
} as const;
