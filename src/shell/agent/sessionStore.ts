import { join } from "node:path";
import { z } from "zod";

import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";
import { readJsonFile, writeJsonFileAtomically } from "~/shell/jsonFile.js";

// In the workspace rather than the user's config directory, for the reason a
// runner is: a session is doing work on the app this checkout tests, and two
// checkouts driven side by side must not hand each other's sessions around.
const storeFileName = "agent.json";

const storeSchema = z.object({ lastSessionId: z.string().optional() });

/** The last agent session this workspace started, so a later `--follow` needs no id. */
export type AgentSessionStore = {
  readLastSessionId: () => Promise<string | undefined>;
  rememberSession: (sessionId: string) => Promise<void>;
};

export function makeAgentSessionStore(options: {
  cwd: string;
  fs: Fs;
}): AgentSessionStore {
  const directory = join(options.cwd, qawolfDir);
  const path = join(directory, storeFileName);

  return {
    async readLastSessionId() {
      const stored = await readJsonFile(options.fs, path, storeSchema);
      return stored?.lastSessionId;
    },
    async rememberSession(sessionId) {
      await options.fs.mkdir(directory, { recursive: true });
      await writeJsonFileAtomically(options.fs, path, {
        lastSessionId: sessionId,
      });
    },
  };
}
