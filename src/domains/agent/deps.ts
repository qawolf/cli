import { sleep as defaultSleep } from "~/core/sleep.js";
import {
  type AgentSessionStore,
  makeAgentSessionStore,
} from "~/shell/agent/sessionStore.js";
import type { Fs } from "~/shell/fs.js";

/**
 * Everything about the machine these handlers touch, in one injectable bundle
 * so that a test drives them with an in-memory filesystem, the environment it
 * chose, and a sleep that does not wait.
 */
export type AgentDeps = {
  env: Record<string, string | undefined>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  store: AgentSessionStore;
};

export function makeAgentDeps(options: {
  cwd: string;
  env: Record<string, string | undefined>;
  fs: Fs;
}): AgentDeps {
  return {
    env: options.env,
    now: Date.now,
    sleep: defaultSleep,
    store: makeAgentSessionStore({ cwd: options.cwd, fs: options.fs }),
  };
}
