// The Linux runner mounts team-storage at this fixed path. Normalizing both
// shapes (literal mount vs. env-var template) onto the env-var form lets the
// pull writer point TEAM_STORAGE_DIR at a local assets/ directory.
//
// Quote-aware: ${...} only interpolates inside template literals. A naive
// prefix swap inside a single- or double-quoted string would yield a literal
// dollar-brace string at runtime. So pass 1 converts a quoted string whose
// content begins with the runner mount prefix to a template literal; pass 2
// then handles the remaining prefix matches, which are now guaranteed to be
// inside template-literal contexts.
const runnerMountPrefix = "/home/wolf/team-storage/";
const envVarPrefix = "${process.env.TEAM_STORAGE_DIR}/";

// Whole-string match: opening quote, the prefix, the rest of the contents,
// matching closing quote. The character class excludes the other quote types
// and newlines so we never span across separate strings.
const quotedRunnerMountRe = /(['"])\/home\/wolf\/team-storage\/([^'"\n]*)\1/g;

type RewriteResult = {
  source: string;
  rewrites: number;
};

export function rewriteTeamStorage(source: string): RewriteResult {
  if (!source.includes(runnerMountPrefix)) {
    return { source, rewrites: 0 };
  }
  let rewrites = 0;
  let out = source.replace(quotedRunnerMountRe, (_match, _quote, rest) => {
    rewrites += 1;
    return `\`${envVarPrefix}${rest}\``;
  });
  if (out.includes(runnerMountPrefix)) {
    out = out.replaceAll(runnerMountPrefix, () => {
      rewrites += 1;
      return envVarPrefix;
    });
  }
  return { source: out, rewrites };
}
