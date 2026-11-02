// The subset of input shapes that can be expressed as CLI flags. Contracts
// are kept inside this subset by tests in @qawolf/api-contracts. A top-level
// field only becomes a JSON flag when it holds objects that cannot be
// flattened into the other kinds (see flagSpecs.ts).
export type FlagKind =
  | "string"
  | "number"
  | "boolean"
  | "string-array"
  | "key-value-record"
  | "json";

export type JsonSchema = {
  // A union of plain types, nullable included, comes out as a list of types.
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: unknown;
  enum?: unknown[];
};

export function flagKind(
  schema: JsonSchema,
):
  | { ok: true; kind: Exclude<FlagKind, "json"> }
  | { ok: false; reason: string } {
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
    reason: `type ${[schema.type ?? "unknown"].flat().join(" or ")} cannot be expressed as a flag`,
  };
}

const isObjectSchema = (schema: JsonSchema): boolean => {
  const members = schema.allOf ?? schema.oneOf ?? schema.anyOf;
  if (members) return members.every(isObjectSchema);
  return schema.type === "object";
};

const isObjectList = (schema: JsonSchema): boolean =>
  schema.type === "array" && !!schema.items && isObjectSchema(schema.items);

// `.nullable()` adds a `null` member to `anyOf`, which JSON can carry as is.
const withoutNull = (schema: JsonSchema): JsonSchema => {
  const members = schema.anyOf?.filter((member) => member.type !== "null");
  if (!members?.length || members.length === schema.anyOf?.length) {
    return schema;
  }
  return members.length === 1 && members[0] ? members[0] : { anyOf: members };
};

// An object (or a combinator of objects), or a list of them, either of which
// may also be null.
export const holdsObjects = (schema: JsonSchema): boolean => {
  const value = withoutNull(schema);
  return isObjectSchema(value) || isObjectList(value);
};
