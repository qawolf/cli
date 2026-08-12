import { describe, expect, it } from "bun:test";

import { makeAuthCtx } from "./deps.testUtils.js";
import {
  createJournalCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import { makeJournal } from "./journal.testUtils.js";

describe("createJournalCursor", () => {
  // The first read carries no cursor, so it starts at the oldest entry the runner
  // still holds and by definition missed nothing. Measuring it against sequence
  // zero would report the whole rotated history of a long-lived runner as a hole
  // in output that has none.
  it("says nothing about dropped entries on its first read", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        recorder: [
          { oldestAvailableSequence: 4001, payloads: [{ code: "a" }] },
        ],
      }),
    );

    await createJournalCursor(ctx, "ci", { stream: "recorder" })();

    expect(warnings()).toEqual([]);
  });

  // Against a cursor it is meaningful: the journal is size-capped and drops its
  // oldest entries, so a reader that falls behind is handed a window beginning
  // after where it asked to continue from, and those entries are gone.
  it("says how many entries were dropped once it holds a cursor", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        recorder: [
          [{ code: "a" }],
          { oldestAvailableSequence: 91, payloads: [{ code: "b" }] },
        ],
      }),
    );
    const read = createJournalCursor(ctx, "ci", { stream: "recorder" });

    await read();
    await read();

    expect(warnings().join(" ")).toContain("89 entries of recorder");
  });

  it("applies tail to the first read only, then reads from the cursor", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[{ code: "a" }], [{ code: "b" }]] }),
    );
    const read = createJournalCursor(ctx, "ci", {
      stream: "recorder",
      tail: 1,
    });

    await read();
    await read();

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({ tail: 1 });
    expect(callPublicApi.mock.calls[1]?.[1]).not.toHaveProperty("tail");
    expect(callPublicApi.mock.calls[1]?.[1]).toMatchObject({
      sinceSequence: 1,
    });
  });

  // A cursor that moved back would reprint the window it already printed, once a
  // second, for as long as a follow ran.
  it("never moves the cursor backwards", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({
        ok: true,
        value: {
          entries: [],
          hasUnsearchedHistory: false,
          nextSequence: 50,
          oldestAvailableSequence: 1,
          outcome: "read",
        },
      })
      .mockResolvedValue({
        ok: true,
        value: {
          entries: [],
          hasUnsearchedHistory: false,
          nextSequence: 10,
          oldestAvailableSequence: 1,
          outcome: "read",
        },
      });
    const read = createJournalCursor(ctx, "ci", { stream: "recorder" });

    await read();
    await read();
    await read();

    expect(callPublicApi.mock.calls[2]?.[1]).toMatchObject({
      sinceSequence: 50,
    });
  });

  // Repeated once a second, the warning says nothing the first one did not.
  it("warns about unsearched history once rather than on every read", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal(
        { recorder: [[{ code: "a" }], [{ code: "b" }]] },
        { hasUnsearchedHistory: { recorder: true } },
      ),
    );
    const read = createJournalCursor(ctx, "ci", { stream: "recorder" });

    await read();
    await read();

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain("did not look at");
  });

  it("hands an unreachable runner back rather than reporting it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: ["unreachable"] }),
    );

    const read = await createJournalCursor(ctx, "ci", {
      stream: "recorder",
    })();

    expect(read.type).toBe("unreachable");
  });
});

describe("createUnreachableBudget", () => {
  it("spends a poll at a time and is exhausted at the grace window", () => {
    const budget = createUnreachableBudget(30_000);

    expect(budget.exhausted()).toBe(false);
    expect(budget.exhausted()).toBe(true);
  });

  // The budget bounds one outage rather than the whole follow, so a runner that
  // answers again starts over.
  it("starts over once the runner answers again", () => {
    const budget = createUnreachableBudget(30_000);

    budget.exhausted();
    budget.reset();

    expect(budget.exhausted()).toBe(false);
  });
});
