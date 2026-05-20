export type Cleanup = () => void | Promise<void>;

export type SignalRegistry = {
  register: (cleanup: Cleanup) => () => void;
  shutdown: (reason: string) => Promise<void>;
};

export type CreateSignalRegistryOptions = {
  log?: (message: string) => void;
  timeoutMs?: number;
};

const defaultTimeoutMs = 5_000;

export function createSignalRegistry(
  opts: CreateSignalRegistryOptions = {},
): SignalRegistry {
  const log = opts.log ?? ((msg) => console.error(msg));
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs;
  const cleanups: Cleanup[] = [];
  let shutdownPromise: Promise<void> | undefined;

  return {
    register(cleanup) {
      cleanups.push(cleanup);
      return () => {
        if (shutdownPromise !== undefined) return;
        const i = cleanups.indexOf(cleanup);
        if (i !== -1) cleanups.splice(i, 1);
      };
    },

    shutdown(reason) {
      if (shutdownPromise !== undefined) return shutdownPromise;
      const snapshot = [...cleanups].reverse();
      cleanups.length = 0;
      shutdownPromise = (async () => {
        // settled is read after the timeout macrotask fires, by which point every
        // pending settled++ microtask has drained — so the count is reliable.
        let settled = 0;
        const allSettled = Promise.allSettled(
          snapshot.map(async (fn) => {
            try {
              await fn();
            } catch (err) {
              log(
                `[signals] cleanup threw during ${reason}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
              throw err;
            } finally {
              settled++;
            }
          }),
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), timeoutMs);
        });
        const outcome = await Promise.race([
          allSettled.then(() => "done"),
          timeout,
        ]);
        if (timer !== undefined) clearTimeout(timer);
        if (outcome === "timeout") {
          const unsettled = snapshot.length - settled;
          log(
            `[signals] ${unsettled} cleanup(s) did not finish within ${timeoutMs}ms during ${reason}; exiting anyway`,
          );
        }
      })();
      return shutdownPromise;
    },
  };
}
