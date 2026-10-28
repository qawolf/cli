import { describe, expect, it, mock } from "bun:test";

import { createFollowPace } from "./followPace.js";

function makePace(timeoutMs: number) {
  const sleep = mock(async (_milliseconds: number) => {});
  const pace = createFollowPace({ sleep, timeoutMs });
  const slept = () => sleep.mock.calls.map(([milliseconds]) => milliseconds);
  return { pace, slept };
}

describe("createFollowPace", () => {
  it("waits a second after news and longer each time nothing new arrives, up to five", async () => {
    const { pace, slept } = makePace(600_000);

    for (const sawEntries of [true, false, false, false, false, false, false])
      await pace.wait(sawEntries);

    expect(slept()).toEqual([1_000, 2_000, 3_000, 4_000, 5_000, 5_000, 5_000]);
  });

  it("goes back to a second as soon as entries arrive", async () => {
    const { pace, slept } = makePace(600_000);

    for (const sawEntries of [false, false, false, true, false])
      await pace.wait(sawEntries);

    expect(slept()).toEqual([2_000, 3_000, 4_000, 1_000, 2_000]);
  });

  it("never waits past the timeout, and says so once it has been spent", async () => {
    const { pace, slept } = makePace(5_000);

    expect(await pace.wait(false)).toBe("waited");
    expect(await pace.wait(false)).toBe("waited");
    expect(await pace.wait(false)).toBe("timed-out");
    expect(slept()).toEqual([2_000, 3_000]);
    expect(pace.waitedMs()).toBe(5_000);
  });

  it("shortens the last wait to the time left", async () => {
    const { pace, slept } = makePace(4_000);

    await pace.wait(false);
    await pace.wait(false);

    expect(slept()).toEqual([2_000, 2_000]);
  });
});
