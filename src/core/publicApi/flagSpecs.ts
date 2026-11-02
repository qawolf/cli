import { z } from "zod";

import {
  flagKind,
  type FlagKind,
  holdsObjects,
  type JsonSchema,
} from "./flagKind.js";
import { describeFlag } from "./flagDescription.js";
import { flagNameOf, flagUsage, optionKeyOf } from "./flagNames.js";
import { type ObjectShape, toObjectShape } from "./objectShape.js";

export type FlagSpec = {
  // Contract input path this flag maps to, e.g. ["environment", "id"].
  path: string[];
  // Commander's camelized key for `flag`, e.g. "environmentId". Commander
  // derives it from the flag name, not from the path, so a nested leaf is
  // read back under the flattened key rather than under its path.
  optionKey: string;
  // Commander usage string, e.g. "--environment-id <value>".
  flag: string;
  description: string;
  required: boolean;
  kind: FlagKind;
};

export type FlagSpecsResult =
  | { ok: true; flags: FlagSpec[] }
  | { ok: false; field: string; reason: string };

// A property that flattens to an object shape contributes one flag per leaf
// instead of one flag for itself. Reusing toObjectShape means a union nested
// inside a property merges the same way a union at the root does, which is
// what lets `environment: { id } | { name }` become two flags.
//
// A record has `type: "object"` with `additionalProperties` and no
// `properties`, so it falls through to flagKind and stays one KEY=VALUE flag.
function walkableShape(schema: JsonSchema): ObjectShape | undefined {
  const isCombinator = Boolean(schema.allOf ?? schema.oneOf ?? schema.anyOf);
  if (!schema.properties && !isCombinator) return undefined;
  const result = toObjectShape(schema);
  return result.ok ? result.shape : undefined;
}

function fieldFlags(
  fieldSchema: JsonSchema,
  fieldPath: string[],
  required: boolean,
): FlagSpecsResult {
  const nested = walkableShape(fieldSchema);
  if (nested) return collectFlags(nested, fieldPath, required);

  const kind = flagKind(fieldSchema);
  if (!kind.ok)
    return { ok: false, field: fieldPath.join("."), reason: kind.reason };
  return {
    ok: true,
    flags: [leafFlag(fieldSchema, fieldPath, required, kind.kind)],
  };
}

function leafFlag(
  fieldSchema: JsonSchema,
  fieldPath: string[],
  required: boolean,
  kind: FlagKind,
): FlagSpec {
  return {
    path: fieldPath,
    optionKey: optionKeyOf(fieldPath),
    flag: flagUsage(fieldPath, kind),
    description: describeFlag(fieldSchema, kind),
    required,
    kind,
  };
}

function collectFlags(
  shape: ObjectShape,
  path: string[],
  parentRequired: boolean,
): FlagSpecsResult {
  const flags: FlagSpec[] = [];
  for (const [field, fieldSchema] of Object.entries(shape.properties)) {
    const fieldPath = [...path, field];
    // A leaf under an optional parent cannot be mandatory: the caller may omit
    // the whole object.
    const required = parentRequired && shape.required.has(field);

    const result = fieldFlags(fieldSchema, fieldPath, required);
    // A top-level field of objects that won't flatten is one JSON value.
    const json = path.length === 0 && holdsObjects(fieldSchema);
    if (!result.ok && !json) return result;
    flags.push(
      ...(result.ok
        ? result.flags
        : [leafFlag(fieldSchema, fieldPath, required, "json")]),
    );
  }
  return { ok: true, flags };
}

// `environmentId` and `environment.id` kebab to one flag name. Commander would
// bind both to a single option and the losing field would never be sent. Keyed
// on the bare name rather than the full `flag` usage string, since two fields
// of different kinds (e.g. a string-array and a key-value-record) that kebab
// to the same name still collide even though their usage strings differ.
function findFlagCollision(flags: FlagSpec[]): FlagSpecsResult | undefined {
  const claimed = new Map<string, string[]>();
  for (const flag of flags) {
    const name = flagNameOf(flag.path);
    const owner = claimed.get(name);
    if (owner) {
      return {
        ok: false,
        field: flag.path.join("."),
        reason: `flag ${name} collides with field ${owner.join(".")}`,
      };
    }
    claimed.set(name, flag.path);
  }
  return undefined;
}

export function buildFlagSpecs(inputSchema: z.ZodType): FlagSpecsResult {
  const jsonSchema = z.toJSONSchema(inputSchema, {
    io: "input",
  }) as JsonSchema;

  const root = toObjectShape(jsonSchema);
  if (!root.ok) return root;

  const collected = collectFlags(root.shape, [], true);
  if (!collected.ok) return collected;

  return findFlagCollision(collected.flags) ?? collected;
}
