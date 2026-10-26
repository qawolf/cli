import { interactiveRunnerMessages } from "~/core/messages/index.js";

// What `build.requestUpload` answers as a build id.
const buildIdPattern = /^[a-z0-9]{24}obld$/;

/**
 * The build ids a `runner run --builds` names, or why one is not a build id.
 * `--builds` takes every word after it, so a flow file given after it lands
 * here.
 */
export function parseRunBuilds(
  values: readonly string[],
): { ok: true; builds: string[] | undefined } | { ok: false; error: string } {
  const notBuildId = values.find((value) => !buildIdPattern.test(value));
  if (notBuildId !== undefined) {
    return {
      error: interactiveRunnerMessages.notBuildId(notBuildId),
      ok: false,
    };
  }
  return { builds: values.length === 0 ? undefined : [...values], ok: true };
}
