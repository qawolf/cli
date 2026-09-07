import { z } from "zod";

import type { JsonSchema } from "~/core/publicApi/flagKind.js";
import { toObjectShape } from "~/core/publicApi/objectShape.js";

/**
 * Whether a contract accepts a workspace, cached per schema. Deriving it walks
 * the whole input schema, which is more work than every request should repeat,
 * and the contracts are module singletons.
 */
const acceptsWorkspace = new WeakMap<z.ZodType, boolean>();

function takesWorkspaceId(inputSchema: z.ZodType): boolean {
  const cached = acceptsWorkspace.get(inputSchema);
  if (cached !== undefined) return cached;

  // toObjectShape rather than the schema's own `.shape`: a contract whose input
  // is a union or an intersection has no `.shape` at all, so reading it that way
  // dropped the workspace from every such route. This is the same helper that
  // mints the `--workspace-id` flag, so the flag and the injection can no longer
  // disagree about which contracts take a workspace.
  let accepted = false;
  try {
    const jsonSchema = z.toJSONSchema(inputSchema, {
      io: "input",
    }) as JsonSchema;
    const shape = toObjectShape(jsonSchema);
    accepted = shape.ok && "workspaceId" in shape.shape.properties;
  } catch {
    accepted = false;
  }

  acceptsWorkspace.set(inputSchema, accepted);
  return accepted;
}

/**
 * Public routes authorize the workspace per request, so a session works in one
 * by naming it on every call rather than by holding a credential scoped to it.
 * Filling it here means every generated command inherits the choice.
 */
export function applyWorkspaceId<Input>(
  inputSchema: z.ZodType,
  input: Input,
  workspaceId: string | undefined,
): Input {
  if (!workspaceId) return input;
  if (typeof input !== "object" || input === null) return input;

  const existing = (input as { workspaceId?: unknown }).workspaceId;
  if (existing !== undefined) return input;

  if (!takesWorkspaceId(inputSchema)) return input;

  return { ...input, workspaceId };
}
