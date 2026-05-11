import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import superjson from "superjson";
import * as tar from "tar";

export const testBaseUrl = "https://test.qawolf.com";
export const testApiKey = "qawolf_test";
export const testSignedUrl = "https://gcs.example.com/bundle.tar.gz?sig=abc";
export const testExpiresAt = "2099-12-31T00:00:00.000Z";
export const flowsBundlePath = "gitwolf.flowsBundle";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function buildBundle(
  archivePath: string,
  opts: {
    flows: { name: string; data: string }[];
    // Optional: when set, written into the bundle's package.json under
    // `dependencies["@qawolf/flows"]`. Omit to simulate a bundle without
    // any `@qawolf/flows` pin (the user's project may not list it directly).
    bundleFlowsVersion?: string;
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
    const pkg: Record<string, unknown> = { name: "@qawolf/flows-bundle" };
    if (opts.bundleFlowsVersion) {
      pkg["dependencies"] = { "@qawolf/flows": opts.bundleFlowsVersion };
    }
    await writeFile(join(root, "package.json"), JSON.stringify(pkg), "utf8");

    const fileNames = opts.wrapInDir
      ? [opts.wrapInDir]
      : [...opts.flows.map((f) => f.name), "package.json"];
    await tar.c({ gzip: true, file: archivePath, cwd: stage }, fileNames);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

type FetchScenario =
  | { kind: "ok"; sourceArchive: string }
  | { kind: "bundleError"; status: number; body: string }
  | { kind: "downloadError"; status: number; body: string };

type FetchCall = { url: string; init: RequestInit | undefined };

export type FakeFetchResult = {
  fetch: typeof globalThis.fetch;
  calls: FetchCall[];
};

export function makeFakeFetch(scenario: FetchScenario): FakeFetchResult {
  const calls: FetchCall[] = [];

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

    if (url.includes(`/api/trpc/${flowsBundlePath}`)) {
      if (scenario.kind === "bundleError") {
        return new Response(scenario.body, { status: scenario.status });
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

    if (url === testSignedUrl) {
      if (scenario.kind === "downloadError") {
        return new Response(scenario.body, { status: scenario.status });
      }
      if (scenario.kind === "ok") {
        const bytes = await Bun.file(scenario.sourceArchive).bytes();
        return new Response(bytes);
      }
    }

    return new Response("not found", { status: 404 });
  };

  // Bun's `fetch` includes a `preconnect` extension; node's lib.dom doesn't.
  return { fetch: handler as unknown as typeof globalThis.fetch, calls };
}
