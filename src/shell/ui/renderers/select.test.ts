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
