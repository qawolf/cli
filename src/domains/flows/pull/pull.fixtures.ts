import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import superjson from "superjson";
import * as tar from "tar";

export const testBaseUrl = "https://test.qawolf.com";
export const testApiKey = "qawolf_test";
export const testSignedUrl = "https://gcs.example.com/bundle.tar.gz?sig=abc";
const testExpiresAt = "2099-12-31T00:00:00.000Z";
export const flowsBundlePath = "gitwolf.getFlowsBundleUrl";
export const envVarsPath = "environment.getEnvironmentWithVariables";
export const testEnvVars: Record<string, string> = {
  BASE_URL: "https://example.com",
  PASSWORD: "p@ss\"w'd",
};

export async function buildBundle(
  archivePath: string,
  opts: {
    flows: { name: string; data: string }[];
    // When set, all entries are wrapped in a single directory of this name.
    // Used to exercise `flattenSingleWrapper` extraction behavior.
    wrapInDir?: string;
  },
): Promise<void> {
  const stage = await mkdtemp(join(tmpdir(), "qawolf-bundle-stage-"));
  try {
    const root = opts.wrapInDir ? join(stage, opts.wrapInDir) : stage;
    if (opts.wrapInDir) await mkdir(root, { recursive: true });

    for (const f of opts.flows) {
      const target = join(root, f.name);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, f.data, "utf8");
    }
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "@qawolf/flows-bundle" }),
      "utf8",
    );

    const fileNames = opts.wrapInDir
      ? [opts.wrapInDir]
      : [...opts.flows.map((f) => f.name), "package.json"];
    await tar.c({ gzip: true, file: archivePath, cwd: stage }, fileNames);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export type FetchScenario =
  | { kind: "ok"; sourceArchive: string; envVars?: Record<string, string> }
  | { kind: "bundleError"; status: number; body: string }
  | { kind: "downloadError"; status: number; body: string }
  | { kind: "envVarsError"; status: number; body: string }
  | { kind: "networkError"; error: Error };

type FetchCall = { url: string; init: RequestInit | undefined };

export type FakeFetchResult = {
  fetch: typeof globalThis.fetch;
  calls: FetchCall[];
};

// Accepts a single scenario (used for the whole session) or a sequence
// (one per fetch call; the last entry repeats once exhausted).
export function makeFakeFetch(
  scenario: FetchScenario | FetchScenario[],
): FakeFetchResult {
  const calls: FetchCall[] = [];
  const sequence = Array.isArray(scenario) ? scenario : undefined;
  const single = Array.isArray(scenario) ? undefined : scenario;

  const handler = async (
    input: string | URL | Request,
    init: RequestInit | undefined,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });

    const active =
      sequence !== undefined
        ? (sequence[
            Math.min(calls.length - 1, sequence.length - 1)
          ] as FetchScenario)
        : (single as FetchScenario);

    if (active.kind === "networkError") throw active.error;

    if (url.includes(`/api/trpc/${flowsBundlePath}`)) {
      if (active.kind === "bundleError") {
        return new Response(active.body, { status: active.status });
      }
      const body = {
        result: {
          data: superjson.serialize({
            url: testSignedUrl,
            expiresAt: testExpiresAt,
          }),
        },
      };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes(`/api/trpc/${envVarsPath}`)) {
      if (active.kind === "envVarsError") {
        return new Response(active.body, { status: active.status });
      }
      const vars =
        active.kind === "ok" && active.envVars ? active.envVars : testEnvVars;
      const body = {
        result: {
          data: superjson.serialize({ environmentVariables: vars }),
        },
      };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url === testSignedUrl) {
      if (active.kind === "downloadError") {
        return new Response(active.body, { status: active.status });
      }
      if (active.kind === "ok") {
        const bytes = await Bun.file(active.sourceArchive).bytes();
        return new Response(bytes);
      }
    }

    return new Response("not found", { status: 404 });
  };

  // Bun's `fetch` includes a `preconnect` extension; node's lib.dom doesn't.
  return { fetch: handler as unknown as typeof globalThis.fetch, calls };
}
