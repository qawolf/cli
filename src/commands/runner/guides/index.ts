import act from "./act.txt";
import actions from "./actions.txt";
import events from "./events.txt";
import exec from "./exec.txt";
import { formatGuide } from "./formatGuide.js";
import highlightSelector from "./highlightSelector.txt";
import importPackage from "./importPackage.txt";
import inspect from "./inspect.txt";
import keepalive from "./keepalive.txt";
import launch from "./launch.txt";
import list from "./list.txt";
import listRecordings from "./listRecordings.txt";
import promoteSnapshot from "./promoteSnapshot.txt";
import record from "./record.txt";
import run from "./run.txt";
import screenshot from "./screenshot.txt";
import stopOrTerminate from "./stopOrTerminate.txt";
import workflow from "./workflow.md" with { type: "text" };

/** Per-command guides, appended to each command's `--help`. */
export const runnerGuides = {
  act: formatGuide(act),
  actions: formatGuide(actions),
  events: formatGuide(events),
  exec: formatGuide(exec),
  highlightSelector: formatGuide(highlightSelector),
  importPackage: formatGuide(importPackage),
  inspect: formatGuide(inspect),
  keepalive: formatGuide(keepalive),
  launch: formatGuide(launch),
  list: formatGuide(list),
  listRecordings: formatGuide(listRecordings),
  promoteSnapshot: formatGuide(promoteSnapshot),
  record: formatGuide(record),
  run: formatGuide(run),
  screenshot: formatGuide(screenshot),
  stopOrTerminate: formatGuide(stopOrTerminate),
};

/**
 * What spans the runner commands, as Markdown. Only `qawolf help ref` prints
 * it, so `qawolf runner --help` stays a short list of commands.
 */
export const runnerWorkflowGuide = workflow;
