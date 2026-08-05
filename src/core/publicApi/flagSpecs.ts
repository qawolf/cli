import { z } from "zod";

import {
  environmentFlagAlias,
  environmentIdField,
} from "~/core/environmentFlag.js";

import { flagKind, type FlagKind, type JsonSchema } from "./flagKind.js";
import { toObjectShape } from "./objectShape.js";

export type FlagSpec = {
  // Contract input field this flag maps to, e.g. "environmentId".
  field: string;
  // Commander usage string, e.g. "--environment-id <value>".
  flag: string;
  // Additional flag name accepted for the same field, e.g. "--env".
  alias: string | undefined;
  description: string;
  required: boolean;
  kind: FlagKind;
};

export type FlagSpecsResult =
  | { ok: true; flags: FlagSpec[] }
  | { ok: false; field: string; reason: string };

const fieldAliases: Record<string, string> = {
  [environmentIdField]: environmentFlagAlias,
};

const kebabCase = (field: string): string =>
  field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const flagName = (field: string): string => `--${kebabCase(field)}`;

function flagUsage(field: string, kind: FlagKind): string {
  const name = flagName(field);
  if (kind === "boolean") return name;
  if (kind === "string-array") return `${name} <values...>`;
  if (kind === "key-value-record") return `${name} <KEY=VALUE...>`;
  return `${name} <value>`;
}

function aliasFor(
  field: string,
  ownedNames: ReadonlySet<string>,
): string | undefined {
  const alias = fieldAliases[field];
  if (alias === undefined || ownedNames.has(alias)) return undefined;
  return alias;
}

export function buildFlagSpecs(inputSchema: z.ZodType): FlagSpecsResult {
  const jsonSchema = z.toJSONSchema(inputSchema, {
    io: "input",
  }) as JsonSchema;

  const result = toObjectShape(jsonSchema);
  if (!result.ok) return result;

  const ownedNames = new Set(
    Object.keys(result.shape.properties).map(flagName),
  );

  const flags: FlagSpec[] = [];
  for (const [field, fieldSchema] of Object.entries(result.shape.properties)) {
    const kind = flagKind(fieldSchema);
    if (!kind.ok) return { ok: false, field, reason: kind.reason };
    flags.push({
      field,
      flag: flagUsage(field, kind.kind),
      alias: aliasFor(field, ownedNames),
      description: fieldSchema.description ?? "",
      required: result.shape.required.has(field),
      kind: kind.kind,
    });
  }
  return { ok: true, flags };
}
