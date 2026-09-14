/**
 * Which id a command means: the one given, else the environment, else the one
 * stored. Most explicit wins, and each level is one a caller can see and change.
 */
export async function resolveIdFrom(options: {
  given: string | undefined;
  env: Record<string, string | undefined>;
  environmentVariable: string;
  readStored: () => Promise<string | undefined>;
}): Promise<string | undefined> {
  if (options.given !== undefined) return options.given;
  const fromEnvironment = options.env[options.environmentVariable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  return options.readStored();
}
