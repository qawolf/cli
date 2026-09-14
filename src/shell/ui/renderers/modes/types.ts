import type { WithProgressFn } from "./progress.js";

type StepProgress = { current: number; total: number };

/** One message from something that talks, as its parts. */
export type TranscriptEntry = { body: string; data: unknown; headline: string };

export type RendererSet = {
  intro(title: string): void;
  note(message: string, title?: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  step(message: string, progress?: StepProgress): void;
  success(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  error(title: string, body?: string): void;
  output(data: unknown, humanMessage: string): void;
  gap(): void;
  /**
   * One line of primary command data to stdout, in every output mode.
   *
   * Apart from `write`, which is decoration and so goes to stderr where an agent
   * reads it and nowhere at all in json mode. A streamed journal line is the
   * answer to the command, and `qawolf runner events recorder | jq` has to see it
   * whether a terminal, a pipe or a harness is on the other end.
   *
   * Two arguments for the same reason `output` takes two: json mode owes its
   * reader parseable lines, and a run's log message is prose. Redirecting stdout
   * is enough to select json mode, so a single pre-rendered string would put
   * prose on the same stream as JSON objects and break every consumer of
   * `qawolf runner run --follow > run.log`.
   */
  stream(data: unknown, line: string): void;
  // Framing is why this is not `stream`: a terminal wants clack's guide rail
  // so a message running to several lines holds together, an agent wants
  // Markdown with no box drawing to strip, and json wants the object. One
  // pre-rendered string would make two of them wear the third's furniture. Not
  // `output` either, whose human rendering is the CLI's own `info` mark.
  /**
   * One message from something that talks, as primary command data. Of the
   * three stdout methods: `output` is the one result a command answers with,
   * `stream` a line relayed verbatim, `transcript` a message with known edges.
   */
  transcript(entry: TranscriptEntry): void;
  /**
   * A spinner for a stretch with nothing to print, in a terminal only; the
   * other modes answer with a handle that does nothing. `stop` erases it, so
   * what stays on screen is exactly what the log methods drew.
   */
  wait(message: string): { stop(): void };
  write(text: string): void;
  withProgress: WithProgressFn;
};
