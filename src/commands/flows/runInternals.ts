import type {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import type { BrowserName, TraceMode, VideoMode } from "~/types.js";

export type FlowsRunFlags = {
  readonly retries: number;
  readonly bail: boolean;
  readonly workers: number;
  readonly timeout: number;
  readonly video: VideoMode;
  readonly trace: TraceMode;
  readonly outputDir: string;
};

export type FlowsRunDeps = {
  readonly cwd: string;
  readonly expandPatterns: typeof defaultExpandPatterns;
  readonly peekFlowMeta: typeof defaultPeekFlowMeta;
  readonly installBrowsers: (
    ctx: CommandContext,
    pattern: string | undefined,
  ) => Promise<CommandResult>;
};

export type ResolvedFlow = {
  readonly file: string;
  readonly name: string;
  readonly browser: BrowserName;
};

export function unsupportedTargetMessage(target: string): string {
  if (target.startsWith("Android - ")) {
    return "Android targets aren't yet implemented in v0.1; tracked in WIZ-10446.";
  }
  return `${target} targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.`;
}
