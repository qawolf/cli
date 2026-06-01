import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Fs } from "~/shell/fs.js";
import type { PlatformResult } from "./requestWithRetry.js";
import { describeBundleDownloadError } from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  fs: Fs;
};

export async function downloadBundle(
  signedUrl: string,
  deps: Deps,
): Promise<PlatformResult<{ tmpArchive: string }>> {
  const tmpArchive = join(
    tmpdir(),
    `qawolf-pull-${randomBytes(8).toString("hex")}.tar.gz`,
  );
  const result = await fetchSignedUrl(
    { url: signedUrl, dest: tmpArchive },
    { fetch: deps.fetch, fs: deps.fs },
  );
  if (!result.ok) {
    await deps.fs.unlink(tmpArchive).catch(() => {});
    return { ok: false, error: describeBundleDownloadError(result.error) };
  }
  return { ok: true, value: { tmpArchive } };
}
