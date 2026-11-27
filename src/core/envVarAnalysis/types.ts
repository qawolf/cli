/** What one flow reads from the environment once its call graph is walked. */
export type FlowEnvVars = {
  names: string[];
  /** A dynamic key or unresolved local call means `names` is only a known subset. */
  mayBeIncomplete: boolean;
};

/** Known reads and uncertainty for an executable unit. */
export type EnvReads = {
  names: Set<string>;
  dynamic: boolean;
};
