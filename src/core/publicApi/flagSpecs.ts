import { z } from "zod";

// The subset of input shapes that can be expressed as CLI flags. Contracts
// are kept inside this subset by tests in @qawolf/api-contracts.
type FlagKind =
  | "string"
  | "number"
  | "boolean"
  | "string-array"
  | "key-value-record";

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

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
};

const kebabCase = (field: string): string =>
  field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

function flagKind(
  schema: JsonSchema,
): { ok: true; kind: FlagKind } | { ok: false; reason: string } {
  if (schema.type === "string") return { ok: true, kind: "string" };
  if (schema.type === "number" || schema.type === "integer") {
    return { ok: true, kind: "number" };
  }
  if (schema.type === "boolean") return { ok: true, kind: "boolean" };
  if (schema.type === "array") {
    if (schema.items?.type !== "string") {
      return {
        ok: false,
        reason: "only string arrays can be expressed as flags",
      };
    }
    return { ok: true, kind: "string-array" };
  }
  if (schema.type === "object") {
    if (schema.properties) {
      return {
        ok: false,
        reason: "nested objects cannot be expressed as flags",
      };
    }
    if (
      typeof schema.additionalProperties === "object" &&
      schema.additionalProperties.type === "string"
    ) {
      return { ok: true, kind: "key-value-record" };
    }
    return { ok: false, reason: "nested objects cannot be expressed as flags" };
  }
  return {
    ok: false,
    reason: `type ${schema.type ?? "unknown"} cannot be expressed as a flag`,
  };
}

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
