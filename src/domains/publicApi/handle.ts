import { z } from "zod";

import type { FlagSpec } from "~/core/publicApi/flagSpecs.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { CommandSpec } from "./commandSpecs.js";

type AssembledInput =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; error: string };

const flagName = (flag: FlagSpec): string =>
  flag.flag.split(" ", 1)[0] ?? flag.flag;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function parseKeyValueRecord(
  flag: FlagSpec,
  pairs: string[],
): { ok: true; record: Record<string, string> } | { ok: false; error: string } {
  const record: Record<string, string> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex < 1) {
      return {
        ok: false,
        error: `Invalid ${flagName(flag)} value "${pair}": expected KEY=VALUE.`,
      };
    }
    record[pair.slice(0, separatorIndex)] = pair.slice(separatorIndex + 1);
  }
  return { ok: true, record };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Writes `value` at `path`, creating the objects the path walks through so
// several leaves of one nested field land in the same object.
function setAtPath(
  input: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  const leaf = path[path.length - 1];
  if (leaf === undefined) return;
  const target = path.slice(0, -1).reduce<Record<string, unknown>>(
    (node, segment) => {
      const existing = node[segment];
      const next = isRecord(existing) ? existing : {};
      node[segment] = next;
      return next;
    },
    input,
  );
  target[leaf] = value;
}

// Commander camelizes flag names, so a nested leaf arrives under the
// flattened key its flag produced, e.g. `--metadata-commit-sha` under
// `metadataCommitSha`. FlagSpec.path puts it back where the contract wants it.
export function assembleInput(
  flags: FlagSpec[],
  options: Record<string, unknown>,
): AssembledInput {
  const input: Record<string, unknown> = {};
  for (const flag of flags) {
    const value = options[flag.optionKey];
    if (value === undefined) continue;
    if (flag.kind === "key-value-record") {
      if (!isStringArray(value)) {
        return {
          ok: false,
          error: `Invalid ${flagName(flag)} value: expected KEY=VALUE pairs.`,
        };
      }
      const parsed = parseKeyValueRecord(flag, value);
      if (!parsed.ok) return parsed;
      setAtPath(input, flag.path, parsed.record);
    } else if (flag.kind === "number") {
      setAtPath(input, flag.path, Number(value));
    } else {
      setAtPath(input, flag.path, value);
    }
  }
  return { ok: true, input };
}

function renderHuman(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .map(
        ([key, fieldValue]) =>
          `${key}: ${
            typeof fieldValue === "string"
              ? fieldValue
              : JSON.stringify(fieldValue)
          }`,
      )
      .join("\n");
  }
  return JSON.stringify(value);
}

export async function handlePublicApiCommand(
  ctx: AuthCommandContext,
  spec: CommandSpec,
  options: Record<string, unknown>,
): Promise<CommandResult> {
  const assembled = assembleInput(spec.flags, options);
  if (!assembled.ok) return { error: assembled.error };

  // Validate locally before any network call so flag mistakes get fast,
  // field-level feedback instead of a server error.
  const parsed = spec.contract.input.safeParse(assembled.input);
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const result = await ctx.platformClient.callPublicApi(
    spec.contract,
    parsed.data,
  );
  if (!result.ok) return failureFields(result);

  ctx.ui.output(result.value, renderHuman(result.value));
  return undefined;
}
