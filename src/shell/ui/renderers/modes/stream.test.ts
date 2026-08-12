import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createAgentRenderers } from "./agent.js";
import { createHumanRenderers } from "./human.js";
import { createJsonRenderers } from "./json.js";

// A streamed journal line is the answer to the command, not decoration, so it
// goes to stdout whether a terminal, a pipe or an agent harness is reading. This
// is what makes `qawolf runner events recorder --tail 5 | jq` work in every mode.
describe("stream", () => {
  afterEach(() => {
    mock.restore();
  });

  const stdoutSpy = () =>
    spyOn(process.stdout, "write").mockImplementation(() => true);

  for (const [mode, make] of Object.entries({
    agent: () => createAgentRenderers(),
    human: () => createHumanRenderers(makeClack()),
  })) {
    it(`writes the rendered line to stdout in ${mode} mode`, () => {
      const stdout = stdoutSpy();

      make().stream({ message: "clicked Sign in" }, "clicked Sign in");

      expect(stdout).toHaveBeenCalledWith("clicked Sign in\n");
    });
  }

  // Redirecting stdout is enough to select json mode, so `qawolf runner run
  // --follow > run.log` lands here. A run's log message is prose, and putting
  // prose on the same stream as the command's JSON would leave neither
  // parseable.
  it("writes the data as JSON in json mode rather than the rendered line", () => {
    const stdout = stdoutSpy();

    createJsonRenderers().stream(
      { message: "clicked Sign in", sequence: 3 },
      "clicked Sign in",
    );

    expect(stdout).toHaveBeenCalledWith(
      '{"message":"clicked Sign in","sequence":3}\n',
    );
  });
});
