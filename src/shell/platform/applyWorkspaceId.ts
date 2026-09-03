/**
 * Public routes authorize the workspace per request, so a session works in one
 * by naming it on every call rather than by holding a credential scoped to it.
 * Filling it here means every generated command inherits the choice.
 */
export function applyWorkspaceId<Input>(
  inputSchema: unknown,
  input: Input,
  workspaceId: string | undefined,
): Input {
  if (!workspaceId) return input;
  if (typeof input !== "object" || input === null) return input;

  const existing = (input as { workspaceId?: unknown }).workspaceId;
  if (existing !== undefined) return input;

  // The contracts are zod objects, so their accepted keys are readable from the
  // shape. Anything else is left alone rather than guessed at.
  const shape = (inputSchema as { shape?: Record<string, unknown> }).shape;
  if (!shape || !("workspaceId" in shape)) return input;

  return { ...input, workspaceId };
}
