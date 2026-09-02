import type { FlowSelectors } from "~/core/flowSelectors.js";
import {
  findPulledEnv as defaultFindPulledEnv,
  listPulledEnvDirs as defaultListPulledEnvDirs,
} from "~/shell/manifest/pulledEnv.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";

import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "./expand.js";
import { flowsList } from "./list.js";
import { readCachedTags as defaultReadCachedTags } from "./readCachedTags.js";
import { readEnvLabel as defaultReadEnvLabel } from "./readEnvLabel.js";

export function handleFlowsList(
  ctx: CommandContext,
  pattern: string | undefined,
  selectors?: FlowSelectors & { env?: string | undefined },
): Promise<CommandResult> {
  const { fs } = ctx;
  return flowsList(
    ctx,
    pattern,
    {
      cwd: process.cwd(),
      expandPatterns: (patterns, cwd) =>
        defaultExpandPatterns(patterns, cwd, undefined, fs),
      peekFlowMeta: makePeekFlowMeta(fs),
      readCachedTags: (files) => defaultReadCachedTags(files, fs),
      readEnvLabel: (envDir) => defaultReadEnvLabel(envDir, fs),
      findPulledEnv: (ref) => defaultFindPulledEnv(ref, process.cwd(), fs),
      listPulledEnvDirs: () => defaultListPulledEnvDirs(process.cwd(), fs),
    },
    selectors,
  );
}
