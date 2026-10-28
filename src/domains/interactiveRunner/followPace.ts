const firstDelayMs = 1_000;
const longestDelayMs = 5_000;

export type FollowPace = {
  wait: (sawEntries: boolean) => Promise<"timed-out" | "waited">;
  waitedMs: () => number;
};

export function createFollowPace(options: {
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
}): FollowPace {
  let idleReads = 0;
  let waitedMs = 0;
  return {
    wait: async (sawEntries) => {
      idleReads = sawEntries ? 0 : idleReads + 1;
      const remainingMs = options.timeoutMs - waitedMs;
      if (remainingMs <= 0) return "timed-out";
      const delayMs = Math.min(
        longestDelayMs,
        firstDelayMs * (idleReads + 1),
        remainingMs,
      );
      await options.sleep(delayMs);
      waitedMs += delayMs;
      return "waited";
    },
    waitedMs: () => waitedMs,
  };
}
