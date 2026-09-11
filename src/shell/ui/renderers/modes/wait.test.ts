import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { createAgentRenderers } from "./agent.js";
import { createJsonRenderers } from "./json.js";

afterEach(() => {
  mock.restore();
});

// A wait line is redrawn every fraction of a second and erased afterwards,
// which a pipe, a CI log or an agent cannot show and cannot undo.
describe("wait outside a terminal", () => {
  it("writes nothing in json or agent mode", () => {
    const stdout = spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = spyOn(process.stderr, "write").mockReturnValue(true);

    createJsonRenderers().wait("Waiting").stop();
    createAgentRenderers().wait("Waiting").stop();

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });
});
