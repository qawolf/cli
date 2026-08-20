import { z } from "zod";

import { flagKind, type FlagKind, type JsonSchema } from "./flagKind.js";
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

// An enum field accepts nothing but its own values, so --help lists them rather
// than leaving a caller to learn them from a rejected invocation. The wording
// matches what objectShape.ts gives a union discriminator, so generated help
// describes a closed set of choices the same way wherever one appears.
function describeFlag(schema: JsonSchema): string {
  const description = schema.description ?? "";
  // An array field carries its values on the item schema, so a repeatable flag
  // like --statuses documents the same closed set a scalar one does.
  const values = schema.enum ?? schema.items?.enum;
  if (!values?.length) return description;
  const choices = `One of: ${values.join(", ")}`;
  return description ? `${description} ${choices}` : choices;
}

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

    const nested = walkableShape(fieldSchema);
    if (nested) {
      const result = collectFlags(nested, fieldPath, required);
      if (!result.ok) return result;
      flags.push(...result.flags);
      continue;
    }

    const kind = flagKind(fieldSchema);
    if (!kind.ok) {
      return { ok: false, field: fieldPath.join("."), reason: kind.reason };
    }
    flags.push({
      path: fieldPath,
      optionKey: optionKeyOf(fieldPath),
      flag: flagUsage(fieldPath, kind.kind),
      description: describeFlag(fieldSchema),
      required,
      kind: kind.kind,
    });
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
