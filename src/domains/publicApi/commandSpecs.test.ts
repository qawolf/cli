import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { buildCommandSpecs } from "./commandSpecs.js";
import { skippedContractNames } from "./skippedContracts.js";

describe("buildCommandSpecs", () => {
  it("flattens the published contract tree into command specs", () => {
    const specs = buildCommandSpecs(publicContractsV1, {
      skipContractNames: skippedContractNames,
    });

    const runCreate = specs.find(
      (spec) => spec.trpcPath === "public.run.create",
    );
    expect(runCreate).toBeDefined();
    expect(runCreate?.commandPath).toEqual(["run", "create"]);
    expect(runCreate?.kind).toBe("write");
    expect(runCreate?.description).toBe(
      publicContractsV1.run.create.description,
    );
    expect(runCreate?.contract).toBe(publicContractsV1.run.create);
    expect(runCreate?.flags.map((flag) => flag.path.join("."))).toEqual([
      "aiTaskId",
      "environmentId",
      "environmentVariables",
      "ignoreRules",
      "pullRequestNumber",
      "repository",
      "flowIds",
      "tagNames",
    ]);
  });

  it("skips contracts named in skipContractNames without building their specs", () => {
    // Unmappable input proves the skip happens before flag building: a
    // hand-written contract never has to be expressible as generated flags.
    const skipped = {
      description: "Hand-written elsewhere",
      input: z.object({ config: z.object({ counts: z.array(z.number()) }) }),
      kind: "read",
      name: "flow.list",
      output: z.object({}),
    } as const;
    const kept = {
      description: "Generated",
      input: z.object({ runId: z.string() }),
      kind: "read",
      name: "run.get",
      output: z.object({}),
    } as const;

    const specs = buildCommandSpecs(
      { flow: { list: skipped }, run: { get: kept } },
      { skipContractNames: new Set(["flow.list"]) },
    );

    expect(specs.map((spec) => spec.trpcPath)).toEqual(["public.run.get"]);
  });

  it("throws when a contract name does not match its position in the tree", () => {
    const contract = {
      description: "Mismatched",
      input: z.object({}),
      kind: "read",
      name: "other.path",
      output: z.object({}),
    } as const;

    expect(() => buildCommandSpecs({ run: { create: contract } })).toThrow(
      'Contract at "run.create" declares name "other.path"',
    );
  });

  it("throws when a contract input cannot be expressed as flags", () => {
    const contract = {
      description: "Unmappable",
      input: z.object({ config: z.object({ counts: z.array(z.number()) }) }),
      kind: "read",
      name: "run.inspect",
      output: z.object({}),
    } as const;

    expect(() => buildCommandSpecs({ run: { inspect: contract } })).toThrow(
      'Contract "run.inspect" input "config.counts"',
    );
  });
});
