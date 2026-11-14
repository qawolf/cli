import superjson, { type SuperJSONResult } from "superjson";

type Route = () => Response;

export function trpcReply(value: unknown): Response {
  return new Response(
    JSON.stringify({ result: { data: superjson.serialize(value) } }),
    { headers: { "content-type": "application/json" } },
  );
}

export function reportedTrigger(fields: { isPaused: boolean }): Response {
  return trpcReply({
    trigger: {
      configuration: { actionCount: 1, kind: "advanced", whenCount: 1 },
      createdAt: "2026-11-13T09:00:00.000Z",
      id: "trg-1",
      isPaused: fields.isPaused,
      name: "Nightly smoke",
      updatedAt: "2026-11-13T09:00:00.000Z",
      url: "https://app.qawolf.com/loops/trg-1",
    },
  });
}

export function missingProcedure(path: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        json: {
          code: -32004,
          data: { code: "NOT_FOUND", httpStatus: 404, path },
          message: `No procedure found on path "${path}"`,
        },
      },
    }),
    { headers: { "content-type": "application/json" }, status: 404 },
  );
}

const urlOf = (url: string | URL | Request): string =>
  url instanceof Request ? url.url : url.toString();

const routeOf = (url: string): string =>
  new URL(url).pathname.replace(/^\/api\/trpc\/public\./, "");

export function fakeServer(routes: Record<string, Route>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = routeOf(urlOf(url));
    const body =
      typeof init?.body === "string"
        ? superjson.deserialize(JSON.parse(init.body) as SuperJSONResult)
        : undefined;
    calls.push({ body, path });
    const route = routes[path];
    return route ? route() : missingProcedure(`public.${path}`);
  };
  return {
    bodyOf: (path: string) => calls.find((call) => call.path === path)?.body,
    calledPaths: () => calls.map((call) => call.path),
    fetch: fetch as typeof globalThis.fetch,
  };
}
