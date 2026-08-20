import { flagKind, type JsonSchema } from "./flagKind.js";

// A root schema flattened to a single object shape, whatever combinator
// (intersection, union) it was expressed with.
export type ObjectShape = {
  properties: Record<string, JsonSchema>;
  required: Set<string>;
};

export type ShapeResult =
  | { ok: true; shape: ObjectShape }
  | { ok: false; field: string; reason: string };

const asObjectShape = (schema: JsonSchema): ObjectShape | undefined =>
  schema.type === "object" && schema.properties
    ? { properties: schema.properties, required: new Set(schema.required) }
    : undefined;

function mergeIntersection(members: JsonSchema[]): ShapeResult {
  const shape: ObjectShape = { properties: {}, required: new Set() };
  for (const member of members) {
    const memberShape = asObjectShape(member);
    if (!memberShape) {
      return {
        ok: false,
        field: "",
        reason: "intersection members must be object schemas",
      };
    }
    for (const [field, fieldSchema] of Object.entries(memberShape.properties)) {
      if (field in shape.properties) {
        return {
          ok: false,
          field,
          reason: "field appears in multiple intersection members",
        };
      }
      shape.properties[field] = fieldSchema;
      if (memberShape.required.has(field)) shape.required.add(field);
    }
  }
  return { ok: true, shape };
}

function mergeUnion(branches: JsonSchema[]): ShapeResult {
  const shapes: ObjectShape[] = [];
  for (const branch of branches) {
    const branchShape = asObjectShape(branch);
    if (!branchShape) {
      return {
        ok: false,
        field: "",
        reason: "union branches must be object schemas",
      };
    }
    shapes.push(branchShape);
  }

  const shape: ObjectShape = { properties: {}, required: new Set() };
  for (const branchShape of shapes) {
    for (const [field, fieldSchema] of Object.entries(branchShape.properties)) {
      const existing = shape.properties[field];
      if (!existing) {
        shape.properties[field] = { ...fieldSchema };
        continue;
      }
      const kinds = [flagKind(existing), flagKind(fieldSchema)];
      if (kinds[0]?.ok && kinds[1]?.ok && kinds[0].kind !== kinds[1].kind) {
        return {
          ok: false,
          field,
          reason: "field has conflicting types across union branches",
        };
      }
      if (!existing.description && fieldSchema.description) {
        existing.description = fieldSchema.description;
      }
    }
  }
  // A union does not need a discriminator. `handlePublicApiCommand` validates
  // the assembled input against the contract before sending, so a caller who
  // passes flags from two branches gets a field-level error from the contract
  // rather than a silently accepted request. When a union does have a
  // discriminator, its values still go into --help below.
  const discriminator = Object.keys(shape.properties).find((field) => {
    const values = shapes.map((branch) => branch.properties[field]?.const);
    return (
      values.every((value) => typeof value === "string") &&
      new Set(values).size === shapes.length &&
      shapes.every((branch) => branch.required.has(field))
    );
  });

  for (const [field, fieldSchema] of Object.entries(shape.properties)) {
    const occurrences = shapes.filter((branch) => field in branch.properties);
    if (
      occurrences.length === shapes.length &&
      occurrences.every((branch) => branch.required.has(field))
    ) {
      shape.required.add(field);
    }
    // Surface the discriminator's values so --help documents which branch
    // each selects.
    if (field === discriminator) {
      const values = shapes.map((branch) => branch.properties[field]?.const);
      fieldSchema.description = `One of: ${values.join(", ")}`;
    }
  }
  return { ok: true, shape };
}

export function toObjectShape(schema: JsonSchema): ShapeResult {
  if (schema.allOf) return mergeIntersection(schema.allOf);
  const branches = schema.oneOf ?? schema.anyOf;
  if (branches) return mergeUnion(branches);
  const shape = asObjectShape(schema);
  if (shape) return { ok: true, shape };
  return {
    ok: false,
    field: "",
    reason: "contract input must be an object schema",
  };
}
