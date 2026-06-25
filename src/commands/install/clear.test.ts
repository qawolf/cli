import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { installMessages } from "~/core/messages/index.js";
import { managedEnvBaseDir } from "~/domains/runtimeEnv/index.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeCtx } from "~/shell/commandContext.testUtils.js";

import { handleInstallClear } from "./clear.js";

describe("handleInstallClear", () => {
  const originalRuntimeDir = process.env["QAWOLF_RUNTIME_DIR"];

  beforeEach(() => {
    process.env["QAWOLF_RUNTIME_DIR"] = "/tmp/qawolf-clear-test";
  });

  afterEach(() => {
    if (originalRuntimeDir === undefined) {
      delete process.env["QAWOLF_RUNTIME_DIR"];
    } else {
      process.env["QAWOLF_RUNTIME_DIR"] = originalRuntimeDir;
    }
  });

  it("cancels without clearing when the human declines the confirm", async () => {
    const ctx = makeCtx("human", { fs: makeMemoryFs() });
    ctx.ui.confirm = mock(() => Promise.resolve({ ok: true, value: false }));

    await handleInstallClear(ctx, { yes: false });

    expect(ctx.ui.cancel).toHaveBeenCalledWith(installMessages.clear.cancelled);
    expect(ctx.ui.withProgress).not.toHaveBeenCalled();
  });

  it("clears the cache once the human confirms", async () => {
    const ctx = makeCtx("human", { fs: makeMemoryFs() });
    ctx.ui.confirm = mock(() => Promise.resolve({ ok: true, value: true }));

    await handleInstallClear(ctx, { yes: false });

    expect(ctx.ui.withProgress).toHaveBeenCalledTimes(1);
    expect(ctx.ui.output).not.toHaveBeenCalled();
  });

  it("skips the confirm prompt when --yes is passed", async () => {
    const ctx = makeCtx("human", { fs: makeMemoryFs() });

    await handleInstallClear(ctx, { yes: true });

    expect(ctx.ui.confirm).not.toHaveBeenCalled();
    expect(ctx.ui.withProgress).toHaveBeenCalledTimes(1);
  });

  it("emits structured output and skips the confirm in non-human mode", async () => {
    const ctx = makeCtx("agent", { fs: makeMemoryFs() });

    await handleInstallClear(ctx, { yes: false });

    expect(ctx.ui.confirm).not.toHaveBeenCalled();
    expect(ctx.ui.output).toHaveBeenCalledWith(
      { cleared: false, dir: managedEnvBaseDir() },
      installMessages.clear.nothingToClear,
    );
  });

  it("reports cleared: true when a managed cache exists", async () => {
    const fs = makeMemoryFs();
    const base = managedEnvBaseDir();
    await fs.mkdir(`${base}/abc123`, { recursive: true });
    await fs.writeFile(
      `${base}/abc123/package.json`,
      '{"name":"qawolf-runtime"}',
    );
    const ctx = makeCtx("agent", { fs });

    await handleInstallClear(ctx, { yes: false });

    expect(ctx.ui.output).toHaveBeenCalledWith(
      { cleared: true, dir: base },
      installMessages.clear.cleared,
    );
  });
});
