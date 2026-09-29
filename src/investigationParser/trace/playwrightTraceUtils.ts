import type { JSZipObject } from "jszip";

import type { Bounded } from "./playwrightTraceTypes.js";

export type JsonObject = Record<string, unknown> & {
  _failureText?: unknown;
  _frameref?: unknown;
  _monotonicTime?: unknown;
  _sha1?: unknown;
  callId?: unknown;
  class?: unknown;
  content?: unknown;
  endTime?: unknown;
  error?: unknown;
  expression?: unknown;
  files?: unknown;
  frameId?: unknown;
  frameUrl?: unknown;
  headers?: unknown;
  height?: unknown;
  html?: unknown;
  isMainFrame?: unknown;
  message?: unknown;
  messageType?: unknown;
  method?: unknown;
  name?: unknown;
  pageId?: unknown;
  pageref?: unknown;
  params?: unknown;
  request?: unknown;
  response?: unknown;
  selector?: unknown;
  sha1?: unknown;
  snapshot?: unknown;
  snapshotName?: unknown;
  stacks?: unknown;
  startTime?: unknown;
  status?: unknown;
  text?: unknown;
  time?: unknown;
  timestamp?: unknown;
  type?: unknown;
  url?: unknown;
  value?: unknown;
  width?: unknown;
};
export const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
export function bounded<Item>(
  items: Item[],
  limit: number,
  evidence: number | { incomplete: boolean; malformed: number },
): Bounded<Item> {
  const { incomplete, malformed } =
    typeof evidence === "number"
      ? { incomplete: false, malformed: evidence }
      : evidence;
  const returned = Math.min(items.length, Math.max(0, limit));
  return {
    coverage: {
      incomplete,
      malformed,
      returned,
      total: items.length,
      truncated: returned < items.length,
    },
    items: items.slice(0, returned),
  };
}
export async function readZipText(
  entry: JSZipObject | undefined,
  limit: number,
): Promise<
  { incomplete: boolean; malformed: boolean; text: string } | undefined
> {
  if (!entry) return undefined;
  const content = await readZipBytes(entry, limit);
  return { ...content, text: content.bytes.toString("utf8") };
}

export async function readZipBytes(
  entry: JSZipObject,
  limit: number,
): Promise<{ bytes: Buffer; incomplete: boolean; malformed: boolean }> {
  try {
    return await new Promise((resolve) => {
      const stream = entry.nodeStream();
      const chunks: Buffer[] = [];
      let byteLength = 0;
      let settled = false;
      const finish = (result: {
        bytes: Buffer;
        incomplete: boolean;
        malformed: boolean;
      }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      stream.on("data", (chunk: Buffer) => {
        if (settled) return;
        const remaining = Math.max(0, limit + 1 - byteLength);
        chunks.push(chunk.subarray(0, remaining));
        byteLength += Math.min(chunk.byteLength, remaining);
        if (byteLength > limit) {
          stream.pause();
          finish({
            bytes: Buffer.concat(chunks).subarray(0, limit),
            incomplete: true,
            malformed: false,
          });
        }
      });
      stream.on("end", () =>
        finish({
          bytes: Buffer.concat(chunks),
          incomplete: false,
          malformed: false,
        }),
      );
      stream.on("error", () =>
        finish({
          bytes: Buffer.alloc(0),
          incomplete: true,
          malformed: true,
        }),
      );
    });
  } catch {
    return { bytes: Buffer.alloc(0), incomplete: true, malformed: true };
  }
}
