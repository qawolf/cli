import { describe, expect, it } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";

import { createText } from "./text.js";

const cancelSymbol = Symbol("cancel");

describe("createText", () => {
  it("answers with what was typed, trimmed", async () => {
    const clack = makeClack();
    clack.text.mockResolvedValue("  use acme.test  ");
    clack.isCancel.mockReturnValue(false);

    const result = await createText({ clack, mode: "human" })("Your answer");

    expect(result).toEqual({ ok: true, value: "use acme.test" });
  });

  it("asks with the message alone", async () => {
    const clack = makeClack();
    clack.text.mockResolvedValue("yes");
    clack.isCancel.mockReturnValue(false);

    await createText({ clack, mode: "human" })("Your answer");

    expect(clack.text).toHaveBeenCalledWith({ message: "Your answer" });
  });

  it("treats a cancelled prompt as no answer", async () => {
    const clack = makeClack();
    clack.text.mockResolvedValue(cancelSymbol);
    clack.isCancel.mockReturnValue(true);

    expect(await createText({ clack, mode: "human" })("Your answer")).toEqual({
      ok: false,
    });
  });

  // clack resolves an untouched prompt to the empty string, which a caller
  // would otherwise send on as an answer the reader cannot act on.
  it("treats an empty answer as no answer", async () => {
    const clack = makeClack();
    clack.text.mockResolvedValue("   ");
    clack.isCancel.mockReturnValue(false);

    expect(await createText({ clack, mode: "human" })("Your answer")).toEqual({
      ok: false,
    });
  });

  it("refuses to prompt where there is no terminal to prompt at", async () => {
    const clack = makeClack();

    expect(createText({ clack, mode: "agent" })("Your answer")).rejects.toThrow(
      "interactive terminal",
    );
  });
});
