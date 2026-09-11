import { describe, expect, it } from "bun:test";

import type { AgentReply } from "./session.js";
import { replyParts } from "./formatReply.js";

const reply = (
  text: string,
  askedAt = "2026-09-09T12:00:00.000Z",
  choices?: string[],
): AgentReply => ({ askedAt, text, ...(choices ? { choices } : {}) });

const plain = { listChoices: false };

describe("replyParts", () => {
  it("names the speaker and the time, and hands the text on untouched", () => {
    const parts = replyParts(reply("  Wrote the flow.  "), plain);

    expect(parts.headline).toMatch(/^QA Wolf {2}\d{2}:\d{2}:\d{2}$/);
    expect(parts.body).toBe("Wrote the flow.");
  });

  it("draws no rail and no mark: framing belongs to the renderer", () => {
    const parts = replyParts(reply("One.\nTwo."), plain);

    expect(parts.body).toBe("One.\nTwo.");
    expect(parts.body).not.toContain("│");
    expect(parts.headline).not.toContain("◇");
  });

  it("leaves the time out rather than printing nonsense for one it cannot read", () => {
    expect(replyParts(reply("Hi.", "not a date"), plain).headline).toBe(
      "QA Wolf",
    );
  });

  it("lists the choices under a question only where nothing will prompt for them", () => {
    const question = reply("Which environment?", undefined, [
      "staging",
      "production",
    ]);

    expect(replyParts(question, { listChoices: true }).body).toBe(
      "Which environment?\n\n- staging\n- production",
    );
    expect(replyParts(question, plain).body).toBe("Which environment?");
  });
});
