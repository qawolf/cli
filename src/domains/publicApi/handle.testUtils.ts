import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { UI } from "~/shell/ui/index.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";
import { standInAnnotationJustifications } from "./contract.fixtures.js";

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
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: false,
    },
    annotationJustifications: standInAnnotationJustifications,
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

// Synthetic contract exercising the json flag kind with a list of objects.
export const changesSpec = (): CommandSpec => {
  const contract = {
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: false,
    },
    annotationJustifications: standInAnnotationJustifications,
    name: "fake.report",
    kind: "write" as const,
    description: "synthetic json-flag contract",
    input: z.object({
      changes: z
        .strictObject({
          items: z.array(
            z.strictObject({
              kind: z.enum(["pull-request", "commit"]),
              title: z.string(),
            }),
          ),
        })
        .optional(),
    }),
    output: z.object({ ok: z.boolean() }),
  };
  const spec = buildCommandSpecs({ fake: { report: contract } }).find(
    (candidate) => candidate.trpcPath === "public.fake.report",
  );
  if (!spec) throw new Error("fake.report spec missing");
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
