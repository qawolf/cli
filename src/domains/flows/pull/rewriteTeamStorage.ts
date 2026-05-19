// The Linux runner mounts team-storage at this fixed path. Normalizing both
// shapes (literal mount vs. env-var template) onto the env-var form lets the
// pull writer point TEAM_STORAGE_DIR at a local assets/ directory.
const runnerMountPrefix = "/home/wolf/team-storage/";
const envVarPrefix = "${process.env.TEAM_STORAGE_DIR}/";

type RewriteResult = {
  source: string;
  rewrites: number;
};

export function rewriteTeamStorage(source: string): RewriteResult {
  if (!source.includes(runnerMountPrefix)) {
    return { source, rewrites: 0 };
  }
  let rewrites = 0;
  const out = source.replaceAll(runnerMountPrefix, () => {
    rewrites += 1;
    return envVarPrefix;
  });
  return { source: out, rewrites };
}
