import { formatSeconds } from "~/core/formatSeconds.js";

const followAgain = (sessionId: string) =>
  `qawolf agent get --follow --session ${sessionId}`;

export const sessionGivenTwice = (argument: string, flag: string): string =>
  `Two different sessions were named: "${argument}" as an argument and "${flag}" as --session. Pass one of them.`;

export const agentMessages = {
  answerCancelled:
    "No answer sent, so QA Wolf is still waiting on one. The session keeps its place: answer it whenever you like.",
  answerPrompt: "Your answer",
  answerSendFailed: (reason: string) =>
    `The answer could not be sent: ${reason}. The session is still waiting, so try again.`,
  // Printed instead of prompting when nothing can be typed back — a pipe, a CI
  // job, an agent harness. Exit is clean rather than a failure: a session
  // asking a question has not gone wrong, it has handed the work back.
  blocked: (sessionId: string) =>
    `QA Wolf asked a question and cannot continue until it is answered. Answer it with qawolf agent send "<your answer>" --session ${sessionId}.`,
  // Said once per follow, before the first wait. Stopping the follow and
  // stopping the work are different things, and a person who does not know that
  // either sits through a session they meant to leave or leaves one they meant
  // to keep.
  detachHint:
    "Press Ctrl-C to stop following. The session keeps running in the background.",
  detached: (sessionId: string) =>
    `Stopped following. The session is still running — pick it back up with ${followAgain(sessionId)}.`,
  followTimedOut: (sessionId: string, seconds: number) =>
    `Stopped following after ${formatSeconds(seconds * 1000)}. The session may still be going: pick it back up with ${followAgain(sessionId)}, or pass --timeout to wait longer.`,
  noSession:
    "No session named. Pass --session, set QAWOLF_SESSION_ID, or start one with qawolf agent send.",
  sessionCancelled: (url: string) =>
    `The session was cancelled before it finished. Read how far it got at ${url}.`,
  sessionCompleted: "QA Wolf finished the work.",
  sessionFailed: (url: string) =>
    `The session failed. Read what happened at ${url}.`,
  // The url, not just the id: a session opens in whichever workspace the
  // credential is pointed at, which is not always the one the caller has open
  // in the app. Naming where it went is the difference between a session that
  // is quietly working and one that looks like it was never created.
  sessionAt: (url: string) => `Following ${url}`,
  standing: (status: string, url: string) => `${status} — ${url}`,
  started: (sessionId: string, url: string) =>
    `Started session ${sessionId} — ${url}`,
  // The spinner's text while nothing arrives. clack appends the time elapsed,
  // so this names what is being waited for and no more.
  waiting: "Waiting for QA Wolf",
  // Said once, and only when nothing else is being printed. A session can work
  // for many minutes without saying anything, and a terminal that has printed
  // nothing at all is indistinguishable from one that has hung.
  working:
    "QA Wolf is working. It reports back here as it goes, which can take a few minutes.",
} as const;
