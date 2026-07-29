import { z } from "zod";

import { flagKind, type FlagKind, type JsonSchema } from "./flagKind.js";

export type FlagSpec = {
  // Contract input field this flag maps to, e.g. "environmentId".
  field: string;
  // Commander usage string, e.g. "--environment-id <value>".
  flag: string;
  description: string;
  required: boolean;
  kind: FlagKind;
};

export type FlagSpecsResult =
  | { ok: true; flags: FlagSpec[] }
  | { ok: false; field: string; reason: string };

const kebabCase = (field: string): string =>
  field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

function flagUsage(field: string, kind: FlagKind): string {
  const name = `--${kebabCase(field)}`;
  if (kind === "boolean") return name;
  if (kind === "string-array") return `${name} <values...>`;
  if (kind === "key-value-record") return `${name} <KEY=VALUE...>`;
  return `${name} <value>`;
}

export function buildFlagSpecs(inputSchema: z.ZodType): FlagSpecsResult {
  const jsonSchema = z.toJSONSchema(inputSchema, {
    io: "input",
  }) as JsonSchema;

  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    return {
      ok: false,
      field: "",
      reason: "contract input must be an object schema",
    };
  }

  const required = new Set(jsonSchema.required ?? []);
  const flags: FlagSpec[] = [];
  for (const [field, fieldSchema] of Object.entries(jsonSchema.properties)) {
    const kind = flagKind(fieldSchema);
    if (!kind.ok) return { ok: false, field, reason: kind.reason };
    flags.push({
      field,
      flag: flagUsage(field, kind.kind),
      description: fieldSchema.description ?? "",
      required: required.has(field),
      kind: kind.kind,
    });
  }
  return { ok: true, flags };
}
