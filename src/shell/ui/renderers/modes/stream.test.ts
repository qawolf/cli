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

  const renderers = {
    agent: () => createAgentRenderers(),
    human: () => createHumanRenderers(makeClack()),
    json: () => createJsonRenderers(),
  };

  for (const [mode, make] of Object.entries(renderers)) {
    it(`writes the line to stdout in ${mode} mode`, () => {
      const stdout = spyOn(process.stdout, "write").mockImplementation(
        () => true,
      );

      make().stream('{"code":"click"}');

      expect(stdout).toHaveBeenCalledWith('{"code":"click"}\n');
    });
  }
});
