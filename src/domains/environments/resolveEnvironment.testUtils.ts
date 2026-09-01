import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { mock } from "bun:test";
import type { z } from "zod";

import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";
import type { ResolveEnvironmentDeps } from "./resolveEnvironment.js";

const findContract = publicContractsV1.environment.find;
const getContract = publicContractsV1.environment.get;

type FindOutput = z.output<typeof findContract.output>;
type GetOutput = z.output<typeof getContract.output>;

export type Page = FindOutput;

export function makeDeps(args: {
  mode?: "human" | "json" | "agent";
  envVar?: string;
  pages?: Page[];
  findError?: string;
  findErrorBody?: string;
  // Every fetch returns a page with a nextCursor, so pagination never
  // terminates on its own — for testing the page cap.
  endlessCursor?: boolean;
  // environment.get result for an explicit/env-var ref. Tests that never
  // trigger ref resolution omit both getEnv and getError.
  getEnv?: Page["environments"][number];
  getError?: string;
  getErrorBody?: string;
  /** Marks the getError as a transport failure the platform never answered. */
  getUnreachable?: boolean;
  selectAnswers?: string[];
  selectCancelled?: boolean;
}) {
  const pages = args.pages ?? [];
  let call = 0;
  const findEnvironments = mock(
    async (): Promise<PlatformResult<FindOutput>> => {
      if (args.findError !== undefined) {
        return args.findErrorBody === undefined
          ? { ok: false, error: args.findError }
          : { ok: false, error: args.findError, errorBody: args.findErrorBody };
      }
      if (args.endlessCursor) {
        return {
          ok: true,
          value: {
            defaultEnvironmentId: "env-default",
            environments: [],
            nextCursor: "again",
          },
        };
      }
      const page = pages[call];
      call += 1;
      if (page === undefined) throw new Error("unexpected extra page fetch");
      return { ok: true, value: page };
    },
  );
  const getEnvironment = mock(
    async (_input: unknown): Promise<PlatformResult<GetOutput>> => {
      if (args.getError !== undefined) {
        return {
          ok: false,
          error: args.getError,
          ...(args.getErrorBody === undefined
            ? {}
            : { errorBody: args.getErrorBody }),
          ...(args.getUnreachable ? { unreachable: true } : {}),
        };
      }
      const value = args.getEnv;
      if (value === undefined)
        throw new Error("unexpected environment.get call");
      return { ok: true, value };
    },
  );

  function callPublicApi(
    contract: typeof findContract,
    input: z.input<typeof findContract.input>,
  ): Promise<PlatformResult<FindOutput>>;
  function callPublicApi(
    contract: typeof getContract,
    input: z.input<typeof getContract.input>,
  ): Promise<PlatformResult<GetOutput>>;
  function callPublicApi(contract: { name: string }, input: unknown) {
    if (contract.name === getContract.name) return getEnvironment(input);
    return findEnvironments();
  }

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
  return { deps, findEnvironments, getEnvironment, select, info };
}

export function env(
  id: string,
  name: string,
  kind: "static" | "preview" = "static",
  isDefault = false,
  alias?: string,
): Page["environments"][number] {
  return {
    id,
    isDefault,
    name,
    ...(alias === undefined ? {} : { alias }),
    kind,
    runConcurrencyLimit: "5",
    status: "ready",
    url: "https://x",
  };
}

export function page(
  defaultEnvironmentId: string,
  environments: Page["environments"],
  nextCursor?: string,
): Page {
  return { defaultEnvironmentId, environments, nextCursor };
}
