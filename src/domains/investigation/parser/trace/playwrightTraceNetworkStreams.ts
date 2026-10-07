import type { TraceStream } from "./playwrightTraceTypes.js";

export function indexTraceStreamPages(streams: TraceStream[]) {
  const streamIdsByPage = new Map<string | undefined, string>();
  for (const stream of streams) {
    for (const event of stream.events) {
      for (const pageId of [event.pageId, event.snapshot?.pageId]) {
        if (!streamIdsByPage.has(pageId))
          streamIdsByPage.set(pageId, stream.id);
      }
    }
  }
  return streamIdsByPage;
}
