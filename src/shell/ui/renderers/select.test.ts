import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createSelect } from "./select.js";

const options = [
  { value: "env-1", label: "Staging", hint: "static · ready" },
  { value: "env-2", label: "Production", hint: "static · running" },
];

describe("createSelect", () => {
  afterEach(() => {
    mock.restore();
  });

  it("returns ok with the picked value in human mode", async () => {
    const clack = makeClack();
    clack.select.mockResolvedValue("env-2");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });

    const result = await select("Which environment?", options);

    expect(clack.select).toHaveBeenCalledWith({
      message: "Which environment?",
      options,
    });
    expect(result).toEqual({ ok: true, value: "env-2" });
  });

  it("returns not ok when the user cancels", async () => {
    const clack = makeClack();
    clack.select.mockResolvedValue(Symbol("cancel"));
    clack.isCancel.mockReturnValue(true);
    const select = createSelect({ mode: "human", clack });

    const result = await select("Which environment?", options);

    expect(result).toEqual({ ok: false });
  });

  it("throws in json mode", () => {
    const clack = makeClack();
    const select = createSelect({ mode: "json", clack });

    expect(select("Which environment?", options)).rejects.toThrow(
      "This command requires an interactive terminal. select",
    );
  });

  it("throws in agent mode", () => {
    const clack = makeClack();
    const select = createSelect({ mode: "agent", clack });

    expect(select("Which environment?", options)).rejects.toThrow(
      "This command requires an interactive terminal. select",
    );
  });
});

function makeOptions(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    value: `env-${index}`,
    label: `Environment ${index}`,
  }));
}

/** Pulls the filter clack was handed, so the matching rule is testable. */
function capturedFilter(clack: ReturnType<typeof makeClack>) {
  const call = clack.autocomplete.mock.calls[0]?.[0] as
    | {
        filter?: (
          search: string,
          option: { value: string; label?: string; hint?: string },
        ) => boolean;
      }
    | undefined;
  const filter = call?.filter;
  if (!filter) throw Error("autocomplete was called without a filter");
  return filter;
}

describe("createSelect with a long list", () => {
  afterEach(() => {
    mock.restore();
  });

  // Nine is the first count an employee-sized list stands in for: the
  // arrow-key prompt stops being scannable well before hundreds of entries.
  it("asks with a searchable prompt once the list passes the threshold", async () => {
    const clack = makeClack();
    clack.autocomplete.mockResolvedValue("env-4");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });

    const result = await select("Which organization?", makeOptions(9));

    expect(result).toEqual({ ok: true, value: "env-4" });
    expect(clack.select).not.toHaveBeenCalled();
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the plain list at the threshold, where typing would only slow it", async () => {
    const clack = makeClack();
    clack.select.mockResolvedValue("env-1");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });

    await select("Which organization?", makeOptions(8));

    expect(clack.select).toHaveBeenCalledTimes(1);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it("returns not ok when the search prompt is cancelled", async () => {
    const clack = makeClack();
    clack.autocomplete.mockResolvedValue(Symbol("cancel"));
    clack.isCancel.mockReturnValue(true);
    const select = createSelect({ mode: "human", clack });

    expect(await select("Which organization?", makeOptions(9))).toEqual({
      ok: false,
    });
  });

  it("matches name, slug and id, and ignores case", async () => {
    const clack = makeClack();
    clack.autocomplete.mockResolvedValue("env-0");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });
    await select("Which workspace?", makeOptions(9));
    const filter = capturedFilter(clack);

    const option = {
      value: "ws_123",
      label: "Acme Retail",
      hint: "acme-retail",
    };

    expect(filter("acme", option)).toBe(true);
    expect(filter("RETAIL", option)).toBe(true);
    expect(filter("acme-ret", option)).toBe(true);
    expect(filter("ws_123", option)).toBe(true);
    // Typed with a space, stored with a hyphen.
    expect(filter("acme retail", option)).toBe(true);
    expect(filter("nothing", option)).toBe(false);
  });

  // An empty box must not read as "nothing matches", or the list would vanish
  // the moment someone clears what they typed.
  it("matches everything while the box is empty", async () => {
    const clack = makeClack();
    clack.autocomplete.mockResolvedValue("env-0");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });
    await select("Which workspace?", makeOptions(9));

    expect(capturedFilter(clack)("   ", { value: "ws_1", label: "Acme" })).toBe(
      true,
    );
  });

  it("tolerates an option that carries no label", async () => {
    const clack = makeClack();
    clack.autocomplete.mockResolvedValue("env-0");
    clack.isCancel.mockReturnValue(false);
    const select = createSelect({ mode: "human", clack });
    await select("Which workspace?", makeOptions(9));

    expect(capturedFilter(clack)("ws", { value: "ws_1" })).toBe(true);
  });
});
