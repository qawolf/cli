import type { FlagKind, JsonSchema } from "./flagKind.js";

const jsonSources =
  "Takes JSON inline, @<path> to read it from a file, or - to read it from stdin.";

const joinSentences = (sentences: string[]): string =>
  sentences.filter((sentence) => sentence !== "").join(" ");

// An enum field accepts nothing but its own values, so --help lists them rather
// than leaving a caller to learn them from a rejected invocation. The wording
// matches what objectShape.ts gives a union discriminator, so generated help
// describes a closed set of choices the same way wherever one appears.
export function describeFlag(schema: JsonSchema, kind: FlagKind): string {
  const description = schema.description ?? "";
  if (kind === "json") return joinSentences([description, jsonSources]);
  // An array field carries its values on the item schema, so a repeatable flag
  // like --statuses documents the same closed set a scalar one does.
  const values = schema.enum ?? schema.items?.enum;
  if (!values?.length) return description;
  return joinSentences([description, `One of: ${values.join(", ")}`]);
}
