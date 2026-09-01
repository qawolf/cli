/**
 * How an environment is named, beside its canonical id.
 *
 * Recorded at pull time so a cache directory is recognisable without the
 * platform. Both fields are absent where the resolution path did not learn
 * them: a terminated environment has no alias, and the offline fallback has
 * nothing to learn from.
 */
export type EnvironmentIdentity = {
  readonly slug: string | undefined;
  readonly name: string | undefined;
};
