// The subset of input shapes that can be expressed as CLI flags. Contracts
// are kept inside this subset by tests in @qawolf/api-contracts.
export type FlagKind =
  | "string"
  | "number"
  | "boolean"
  | "string-array"
  | "key-value-record";

export type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
};

export function flagKind(
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
