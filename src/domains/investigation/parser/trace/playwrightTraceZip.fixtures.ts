import {
  type FixtureEntry,
  buildZip,
} from "~/domains/investigation/parser/zip/zipFixture.testUtils.js";

const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

export const frameJpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("synthetic screencast frame".repeat(40)),
]);

const traceEvents = [
  { type: "context-options" },
  {
    callId: "call@1",
    class: "Frame",
    method: "goto",
    startTime: 1,
    type: "before",
  },
  { callId: "call@1", endTime: 2, type: "after" },
  {
    callId: "call@2",
    class: "Frame",
    method: "click",
    params: { selector: 'internal:role=button[name="Save"]' },
    startTime: 3,
    type: "before",
  },
  { callId: "call@2", message: "waiting for button", time: 4, type: "log" },
  {
    messageType: "error",
    pageId: "page-1",
    text: "Save failed",
    time: 4,
    type: "console",
  },
  {
    snapshot: {
      callId: "call@2",
      frameId: "frame-1",
      frameUrl: "https://app.test/",
      html: ["HTML", {}, ["BODY", {}, ["BUTTON", {}, "Save"]]],
      isMainFrame: true,
      pageId: "page-1",
      snapshotName: "before@call@2",
      timestamp: 4,
    },
    type: "frame-snapshot",
  },
  {
    height: 48,
    pageId: "page-1",
    sha1: "frame.jpeg",
    timestamp: 5,
    type: "screencast-frame",
    width: 64,
  },
  {
    callId: "call@2",
    endTime: 6,
    error: { message: "Timeout waiting for button" },
    type: "after",
  },
];

const networkEvents = [
  {
    snapshot: {
      pageref: "page-1",
      request: { headers: [], method: "GET", url: "https://app.test/" },
      response: {
        content: { _sha1: "body.html", mimeType: "text/html" },
        headers: [{ name: "Content-Type", value: "text/html" }],
        status: 500,
      },
    },
    type: "resource-snapshot",
  },
];

const stacks = {
  files: ["/runner/generatedProgram/src/flows/save.js"],
  stacks: [[2, [[0, 12, 5, "saveFlow"]]]],
};

/** A Playwright-style trace zip, with stored padding entries no projection reads to make it as large as a test needs. */
export function playwrightTraceZip(
  options: {
    paddingBytes?: number;
    paddingEntries?: number;
    zip64?: boolean;
  } = {},
): Buffer {
  const paddingEntries = options.paddingEntries ?? 4;
  const paddingSize = Math.ceil((options.paddingBytes ?? 0) / paddingEntries);
  const padding: FixtureEntry[] = options.paddingBytes
    ? Array.from({ length: paddingEntries }, (_, index) => ({
        content: Buffer.alloc(paddingSize, index + 1),
        name: `resources/padding-${index}.bin`,
      }))
    : [];
  return buildZip(
    [
      { compress: true, content: ndjson(traceEvents), name: "0-trace.trace" },
      {
        compress: true,
        content: ndjson(networkEvents),
        name: "0-trace.network",
      },
      {
        compress: true,
        content: JSON.stringify(stacks),
        name: "0-trace.stacks",
      },
      ...padding,
      { content: frameJpeg, name: "resources/frame.jpeg" },
      {
        compress: true,
        content: "<button>Save</button>",
        name: "resources/body.html",
      },
    ],
    { zip64: options.zip64 ?? false },
  );
}
