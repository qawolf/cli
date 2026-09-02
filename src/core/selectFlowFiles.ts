import {
  hasSelectors,
  matchesSelectors,
  type FlowSelectors,
} from "./flowSelectors.js";
import { toRepoRelativePath } from "./repoRelativePath.js";

export type SelectFlowFilesResult =
  | { kind: "selected"; files: string[] }
  /** An explicit selector matched nothing. */
  | { kind: "empty" };

type Args = {
  readonly files: readonly string[];
  readonly cwd: string;
  readonly selectors: FlowSelectors;
  /** Tags keyed by repo-relative path; undefined when tags were not resolved. */
  readonly tagsByPath: ReadonlyMap<string, readonly string[]> | undefined;
};

/**
 * Narrows a set of flow files to those matching the tag selectors.
 *
 * Reports "empty" only when a selector was given and matched nothing — an
 * unfiltered run over zero files is an ordinary empty selection, not a
 * mistake worth failing on.
 */
export function selectFlowFiles(args: Args): SelectFlowFilesResult {
  if (!hasSelectors(args.selectors)) {
    return { kind: "selected", files: [...args.files] };
  }

  const matched = args.files.filter((file) =>
    matchesSelectors(
      { tags: args.tagsByPath?.get(toRepoRelativePath(file, args.cwd)) },
      args.selectors,
    ),
  );
  if (matched.length === 0) return { kind: "empty" };
  return { kind: "selected", files: matched };
}
