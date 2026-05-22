import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { createVerboseContext } from "./createVerboseContext.js";

describe("createVerboseContext", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should return undefined verboseWrite when isVerbose is false", () => {
    const { verboseWrite, verboseTarget } = createVerboseContext(
      "human",
      false,
    );
    expect(verboseWrite).toBeUndefined();
    expect(verboseTarget).toBeUndefined();
  });

  it("should set verboseTarget only for human mode with verbose", () => {
    const { verboseTarget: humanTarget } = createVerboseContext("human", true);
    expect(humanTarget).toBeDefined();
    expect(humanTarget!.write).toBeUndefined();

    const { verboseTarget: jsonTarget } = createVerboseContext("json", true);
    expect(jsonTarget).toBeUndefined();

    const { verboseTarget: agentTarget } = createVerboseContext("agent", true);
    expect(agentTarget).toBeUndefined();
  });

  it("should emit JSON diagnostic with correct schema in json mode", () => {
    const spy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const { verboseWrite } = createVerboseContext("json", true);

    verboseWrite!("debug", "my-scope", "hello world");

    expect(spy).toHaveBeenCalledWith(
      JSON.stringify({
        type: "log",
        scope: "my-scope",
        message: "hello world",
      }) + "\n",
    );
  });

  it("should route through verboseTarget.write when set in human mode", () => {
    const { verboseWrite, verboseTarget } = createVerboseContext("human", true);
    const captured: string[] = [];
    verboseTarget!.write = (msg) => captured.push(msg);

    verboseWrite!("info", "scope", "hello");

    expect(captured).toEqual(["[scope] hello"]);
  });

  it("should not throw when verboseTarget.write is unset in human mode", () => {
    spyOn(process.stdout, "write").mockImplementation(() => true);
    const { verboseWrite } = createVerboseContext("human", true);

    expect(() => verboseWrite!("info", "scope", "msg")).not.toThrow();
  });
});
