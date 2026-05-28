import { describe, expect, it } from "bun:test";

import type { TrpcClient, WireResult } from "./createTrpcClient.js";
import { listTeamStorageFiles } from "./teamStorage.js";

describe("listTeamStorageFiles", () => {
  it("requests subsequent pages with the returned page token", async () => {
    const calls: unknown[] = [];
    const responses: WireResult<unknown>[] = [
      {
        ok: true,
        data: {
          files: [
            {
              path: "one.txt",
              signedUrl: "https://storage.example.com/one",
              size: 1,
            },
          ],
          nextPageToken: "page-2",
        },
      },
      {
        ok: true,
        data: {
          files: [
            {
              path: "two.txt",
              signedUrl: "https://storage.example.com/two",
              size: 2,
            },
          ],
        },
      },
    ];
    const trpc: TrpcClient = {
      query: async (_path, input, schema) => {
        calls.push(input);
        const response = responses.shift();
        if (response === undefined) throw new Error("unexpected request");
        if (!response.ok) return response;
        const parsed = schema.parse(response.data);
        return { ok: true, data: parsed };
      },
      mutation: async () => {
        throw new Error("unexpected mutation");
      },
    };

    const result = await listTeamStorageFiles(
      trpc,
      { teamId: "team_123" },
      { baseUrl: "https://app.qawolf.com" },
    );

    expect(result).toEqual({
      ok: true,
      value: [
        {
          path: "one.txt",
          signedUrl: "https://storage.example.com/one",
          size: 1,
        },
        {
          path: "two.txt",
          signedUrl: "https://storage.example.com/two",
          size: 2,
        },
      ],
    });
    expect(calls).toEqual([
      { teamId: "team_123", excludePrefixes: ["_screenshots_/"] },
      {
        teamId: "team_123",
        excludePrefixes: ["_screenshots_/"],
        pageToken: "page-2",
      },
    ]);
  });
});
