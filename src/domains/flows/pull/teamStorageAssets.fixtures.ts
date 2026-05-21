import { stat } from "node:fs/promises";
import superjson from "superjson";

export type FetchCall = { url: string; init: RequestInit | undefined };

export function makeFetch(): {
  calls: FetchCall[];
  fetch: typeof globalThis.fetch;
} {
  const calls: FetchCall[] = [];
  const fetch = async (
    input: string | URL | Request,
    init: RequestInit | undefined,
  ): Promise<Response> => {
    const url = inputToUrl(input);
    calls.push({ url, init });

    if (url.includes("/api/v0/identity")) {
      return new Response(
        JSON.stringify({
          team: {
            createdAt: "2024-01-01T00:00:00.000Z",
            id: "team_123",
            name: "Test Team",
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/api/trpc/team.listStorageFiles")) {
      return teamStorageFilesResponse();
    }

    if (url === "https://storage.example.com/root") {
      return new Response("root");
    }
    if (url === "https://storage.example.com/root-v2") {
      return new Response("root-v2");
    }
    if (url === "https://storage.example.com/nested") {
      return new Response("nested");
    }

    return new Response("not found", { status: 404 });
  };

  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function inputToUrl(input: string | URL | Request): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function teamStorageFilesResponse(): Response {
  const body = {
    result: {
      data: superjson.serialize({
        files: [
          {
            etag: "root-v1",
            path: "root.txt",
            signedUrl: "https://storage.example.com/root",
            size: 4,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            etag: "nested-v1",
            path: "nested/data.csv",
            signedUrl: "https://storage.example.com/nested",
            size: 6,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        nextPageToken: undefined,
      }),
    },
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
