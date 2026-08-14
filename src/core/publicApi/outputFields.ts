import { z } from "zod";

import type { JsonSchema } from "./flagKind.js";

export type OutputFieldDoc = {
  // Dotted path into the response, with [] marking an array,
  // e.g. "flows[].attempts[].traceUrl".
  path: string;
  description: string;
};

// Deep enough for the nested response shapes contracts actually use, and a
// backstop against a self-referential schema walking forever.
const maxDepth = 12;

type FieldEntry = {
  description: string | undefined;
  // Literal values this field takes, one per union branch it appears in.
  constValues: string[];
};

const branchesOf = (schema: JsonSchema): JsonSchema[] | undefined =>
  schema.allOf ?? schema.oneOf ?? schema.anyOf;

const literalValues = (schema: JsonSchema): string[] => [
  ...(typeof schema.const === "string" ? [schema.const] : []),
  ...(schema.enum ?? []).filter((value) => typeof value === "string"),
];

function record(
  found: Map<string, FieldEntry>,
  path: string,
  schema: JsonSchema,
): void {
  const entry = found.get(path) ?? { description: undefined, constValues: [] };
  const values = literalValues(schema);
  // Only a schema that pins no literal describes the field itself. A branch
  // that pins one describes that branch, and reading its prose as the field's
  // meaning is what made an attempt's status read as "terminated without
  // reaching a verdict".
  if (
    values.length === 0 &&
    entry.description === undefined &&
    schema.description !== undefined
  ) {
    entry.description = schema.description;
  }
  for (const value of values) {
    if (!entry.constValues.includes(value)) entry.constValues.push(value);
  }
  found.set(path, entry);
}

function collect(
  schema: JsonSchema,
  path: string,
  depth: number,
  found: Map<string, FieldEntry>,
): void {
  if (depth > maxDepth) return;

  // A union describes one response shape per branch. Walking every branch and
  // keeping the first description per path lists a field that appears in
  // several branches once, rather than once per branch: an artifact URL is
  // documented on both the passed and the failed attempt variant.
  const branches = branchesOf(schema);
  if (branches) {
    for (const branch of branches) {
      // A branch that is a bare literal has no properties to walk, so its value
      // is only seen here. Without this the whole field goes undocumented.
      record(found, path, branch);
      collect(branch, path, depth + 1, found);
    }
    return;
  }

  if (schema.type === "array") {
    if (schema.items) collect(schema.items, `${path}[]`, depth + 1, found);
    return;
  }

  if (!schema.properties) return;
  for (const [field, fieldSchema] of Object.entries(schema.properties)) {
    const fieldPath = path === "" ? field : `${path}.${field}`;
    record(found, fieldPath, fieldSchema);
    collect(fieldSchema, fieldPath, depth + 1, found);
  }
}

// Flattens a contract's output schema into the described fields worth showing
// in --help. Fields without a description are omitted: the path alone tells a
// reader nothing the JSON would not.
//
// Conversion failures are left to throw. This runs at generation time, so a
// schema it cannot read should fail the build loudly rather than quietly
// produce a reference with fields missing from it.
export function buildOutputFieldDocs(
  outputSchema: z.ZodType,
): OutputFieldDoc[] {
  const jsonSchema = z.toJSONSchema(outputSchema, {
    io: "output",
    // z.date() and z.transform() have no JSON Schema form and throw under the
    // default "throw" policy. Degrading keeps their descriptions.
    unrepresentable: "any",
  }) as JsonSchema;

  const found = new Map<string, FieldEntry>();
  collect(jsonSchema, "", 0, found);
  return [...found].flatMap(([path, entry]) => {
    // A field the branches pin to different literals is documented by the set
    // of values it takes, after its own description when it has one.
    const values =
      entry.constValues.length > 1
        ? `One of: ${entry.constValues.join(", ")}`
        : undefined;
    const description = [entry.description, values]
      .filter((part) => part !== undefined)
      .join(" ");
    return description === "" ? [] : [{ path, description }];
  });
}
