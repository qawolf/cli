/** Which of the three places an id was taken from. */
export type IdSource = "flag" | "environment" | "stored";

export type ResolvedId = { id: string; source: IdSource };

/**
 * Which id a command means: the one given, else the environment, else the one
 * stored. Most explicit wins, and each level is one a caller can see and change.
 *
 * The source travels with the id because a command that cannot reach what the
 * id names has to say which of the three chose it — otherwise a caller reading
 * the failure cannot tell what to change.
 */
export async function resolveIdFrom(options: {
  given: string | undefined;
  env: Record<string, string | undefined>;
  environmentVariable: string;
  readStored: () => Promise<string | undefined>;
}): Promise<ResolvedId | undefined> {
  if (options.given !== undefined) {
    return { id: options.given, source: "flag" };
  }
  const fromEnvironment = options.env[options.environmentVariable]?.trim();
  if (fromEnvironment) {
    return { id: fromEnvironment, source: "environment" };
  }
  const stored = await options.readStored();
  return stored === undefined ? undefined : { id: stored, source: "stored" };
}
