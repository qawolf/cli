type RowOptions = {
  body?: string;
  err?: string;
  kind?: string;
  method?: string;
  seq: number;
  startedAt?: string;
  status?: number;
  url?: string;
};

export function networkLogRow(options: RowOptions): Record<string, unknown> {
  return {
    _qawolf: {
      app: "com.example.app",
      cursor: `a1.${options.seq}`,
      ...(options.err !== undefined && { err: options.err }),
      kind: options.kind ?? "http",
      seq: options.seq,
    },
    cache: {},
    request: {
      bodySize: 2,
      cookies: [],
      headers: [
        { name: "Authorization", value: "Bearer synthetic-secret" },
        { name: "x-request-id", value: `req-${options.seq}` },
      ],
      headersSize: -1,
      httpVersion: "HTTP/2.0",
      method: options.method ?? "GET",
      postData: { mimeType: "application/json", text: "{}" },
      queryString: [],
      url: options.url ?? `https://api.example.test/items/${options.seq}`,
    },
    response: {
      bodySize: 10,
      content: {
        mimeType: "application/json",
        size: 10,
        ...(options.body !== undefined && { text: options.body }),
      },
      cookies: [],
      headers: [{ name: "content-type", value: "application/json" }],
      headersSize: -1,
      httpVersion: "HTTP/2.0",
      redirectURL: "",
      status: options.status ?? 200,
      statusText: "",
    },
    startedDateTime:
      options.startedAt ?? `2026-11-20T09:00:0${options.seq % 10}.000Z`,
    time: 12.5,
    timings: { receive: 0, send: 0, wait: 12.5 },
  };
}

export const networkLogSummaryRow = {
  _qawolf: { droppedRows: 0, kind: "summary", rows: 6 },
};

// A passing-looking run with one real failure among normal rows.
export function networkLogFixture(): Record<string, unknown>[] {
  return [
    networkLogRow({ seq: 1 }),
    networkLogRow({
      err: "EOF",
      kind: "encrypted",
      method: "CONNECT",
      seq: 2,
      status: 0,
    }),
    networkLogRow({ err: "context canceled", seq: 3, status: 0 }),
    { _qawolf: { cursor: "a1.4", dns: {}, kind: "dns", seq: 4 } },
    networkLogRow({
      body: '{"error":"forbidden"}',
      method: "POST",
      seq: 5,
      status: 403,
    }),
    networkLogRow({
      err: "remote error: tls: bad certificate",
      kind: "connection-failed",
      method: "CONNECT",
      seq: 6,
      status: 0,
    }),
  ];
}

export function toNdjson(rows: unknown[]): Uint8Array {
  return Buffer.from(rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}
