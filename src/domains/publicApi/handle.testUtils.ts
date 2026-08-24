import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { UI } from "~/shell/ui/index.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";

export const runCreateSpec = (): CommandSpec => {
  const spec = buildCommandSpecs({
    run: { create: publicContractsV1.run.create },
  }).find((candidate) => candidate.trpcPath === "public.run.create");
  if (!spec) throw new Error("run.create spec missing");
  return spec;
};

// Synthetic contract exercising the number flag kind, which no real public
// contract uses yet.
export const countSpec = (): CommandSpec => {
  const contract = {
    name: "fake.count",
    kind: "write" as const,
    description: "synthetic number-flag contract",
    input: z.object({ count: z.number() }),
    output: z.object({ ok: z.boolean() }),
  };
  const spec = buildCommandSpecs({ fake: { count: contract } }).find(
    (candidate) => candidate.trpcPath === "public.fake.count",
  );
  if (!spec) throw new Error("fake.count spec missing");
  return spec;
};

export function ctxWith(
  ui: UI,
  platformClient: PlatformClient,
): AuthCommandContext {
  return {
    ...makeCtx("human"),
    ui,
    apiKeySource: "env",
    platformClient,
  };
}
