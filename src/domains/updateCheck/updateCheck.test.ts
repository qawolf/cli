import { describe, expect, it } from "bun:test";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { startUpdateCheck } from "./updateCheck.js";

// Let the fetch's .then chain run before reading the settled value.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeNotifier(overrides: {
  env?: Record<string, string | undefined>;
  currentVersion?: string;
  fs?: Fs;
  fetchLatestVersion?: () => Promise<string | undefined>;
  renderNotice?: () => void;
}) {
  const written: { body: string; title: string }[] = [];
  let fetchCalls = 0;
  const notifier = startUpdateCheck({
    env: overrides.env ?? {},
    currentVersion: overrides.currentVersion ?? "1.0.0",
    configDir: "/config",
    fs: overrides.fs ?? makeMemoryFs(),
    fetchLatestVersion: () => {
      fetchCalls += 1;
      return (
        overrides.fetchLatestVersion ?? (() => Promise.resolve("2.0.0"))
      )();
    },
    renderNotice: (body, title) => {
      written.push({ body, title });
      overrides.renderNotice?.();
    },
  });
  return { notifier, written, fetchCalls: () => fetchCalls };
}

describe("startUpdateCheck", () => {
  it("announces a newer version after the fetch settles", async () => {
    const { notifier, written } = makeNotifier({});
    await settle();
    await notifier.notifyIfOutdated();
    expect(written).toHaveLength(1);
    expect(written[0]?.body).toContain("1.0.0 → 2.0.0");
    expect(written[0]?.title).toBe("Update available");
  });

  it("stays silent while the fetch is still pending", async () => {
    const { notifier, written } = makeNotifier({
      fetchLatestVersion: () => new Promise(() => {}),
    });
    await notifier.notifyIfOutdated();
    expect(written).toHaveLength(0);
  });

  it("stays silent when the published version is not newer", async () => {
    const { notifier, written } = makeNotifier({
      currentVersion: "2.0.0",
      fetchLatestVersion: () => Promise.resolve("2.0.0"),
    });
    await settle();
    await notifier.notifyIfOutdated();
    expect(written).toHaveLength(0);
  });

  it("announces each version at most once across runs", async () => {
    const fs = makeMemoryFs();
    const first = makeNotifier({ fs });
    await settle();
    await first.notifier.notifyIfOutdated();
    expect(first.written).toHaveLength(1);

    const second = makeNotifier({ fs });
    await settle();
    await second.notifier.notifyIfOutdated();
    expect(second.written).toHaveLength(0);
  });

  it("announces again when an even newer version ships", async () => {
    const fs = makeMemoryFs();
    const first = makeNotifier({ fs });
    await settle();
    await first.notifier.notifyIfOutdated();

    const second = makeNotifier({
      fs,
      fetchLatestVersion: () => Promise.resolve("3.0.0"),
    });
    await settle();
    await second.notifier.notifyIfOutdated();
    expect(second.written).toHaveLength(1);
    expect(second.written[0]?.body).toContain("1.0.0 → 3.0.0");
  });

  it("does not fetch when QAWOLF_NO_UPDATE_CHECK is set", async () => {
    const { notifier, written, fetchCalls } = makeNotifier({
      env: { QAWOLF_NO_UPDATE_CHECK: "1" },
    });
    await settle();
    await notifier.notifyIfOutdated();
    expect(fetchCalls()).toBe(0);
    expect(written).toHaveLength(0);
  });

  it("still announces (and never throws) when the state file is unwritable", async () => {
    const fs: Fs = {
      ...makeMemoryFs(),
      readFile: () => Promise.reject(new Error("boom")),
      mkdir: () => Promise.reject(new Error("boom")),
      writeFile: () => Promise.reject(new Error("boom")),
    };
    const { notifier, written } = makeNotifier({ fs });
    await settle();
    await notifier.notifyIfOutdated();
    expect(written).toHaveLength(1);
  });

  it("does not throw when rendering fails, and retries next run", async () => {
    const fs = makeMemoryFs();
    const first = makeNotifier({
      fs,
      renderNotice: () => {
        throw new Error("EPIPE");
      },
    });
    await settle();
    await first.notifier.notifyIfOutdated();

    // A failed render must not record the version as announced.
    const second = makeNotifier({ fs });
    await settle();
    await second.notifier.notifyIfOutdated();
    expect(second.written).toHaveLength(1);
  });
});
