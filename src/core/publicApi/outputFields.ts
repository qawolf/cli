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

function record(
  found: Map<string, FieldEntry>,
  path: string,
  schema: JsonSchema,
): void {
  const entry = found.get(path) ?? { description: undefined, constValues: [] };
  if (entry.description === undefined && schema.description !== undefined) {
    entry.description = schema.description;
  }
  if (
    typeof schema.const === "string" &&
    !entry.constValues.includes(schema.const)
  ) {
    entry.constValues.push(schema.const);
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
    for (const branch of branches) collect(branch, path, depth + 1, found);
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
    // of values it takes. One branch's prose describes that branch, not the
    // field, so listing it alone would misread as the field's meaning.
    const description =
      entry.constValues.length > 1
        ? `One of: ${entry.constValues.join(", ")}`
        : entry.description;
    return description === undefined ? [] : [{ path, description }];
  });
}
