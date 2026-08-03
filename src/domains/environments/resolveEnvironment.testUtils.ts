import { mock } from "bun:test";

import type { ResolveEnvironmentDeps } from "./resolveEnvironment.js";

export type Page = {
  environments: {
    id: string;
    name: string;
    kind: "static" | "preview";
    status: "blocked" | "needs-investigation" | "ready" | "running";
    url: string;
  }[];
  nextCursor?: string;
};

export function makeDeps(args: {
  mode?: "human" | "json" | "agent";
  envVar?: string;
  pages?: Page[];
  findError?: string;
  selectAnswers?: string[];
  selectCancelled?: boolean;
}) {
  const pages = args.pages ?? [];
  let call = 0;
  const callPublicApi = mock(async () => {
    if (args.findError !== undefined) {
      return { ok: false as const, error: args.findError };
    }
    const page = pages[call];
    call += 1;
    if (page === undefined) throw new Error("unexpected extra page fetch");
    return { ok: true as const, value: page };
  });
  // One queued answer per expected prompt, in order (kind pick, then env
  // pick). A test that expects a single prompt queues a single answer.
  const answers = [...(args.selectAnswers ?? [])];
  const select = mock(async () => {
    if (args.selectCancelled) return { ok: false as const };
    const next = answers.shift();
    if (next === undefined) throw new Error("unexpected extra select prompt");
    return { ok: true as const, value: next };
  });
  const info = mock();
  const deps: ResolveEnvironmentDeps = {
    platformClient: { callPublicApi },
    ui: { mode: args.mode ?? "human", info, select },
    env: { QAWOLF_ENVIRONMENT: args.envVar },
  };
  return { deps, callPublicApi, select, info };
}

export function env(
  id: string,
  name: string,
  kind: "static" | "preview" = "static",
): Page["environments"][number] {
  return { id, name, kind, status: "ready", url: "https://x" };
}
