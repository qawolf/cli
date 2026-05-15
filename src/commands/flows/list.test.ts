import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import type { CommandContext } from "~/lib/context.js";
import type { OutputMode } from "~/lib/ui/env.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { makeFakeUI } from "./run.fixtures.js";

afterEach(() => {
  mock.restore();
});

const fakeCwd = "/proj";

function makeCtx(
  ui = makeFakeUI(),
  outputMode: OutputMode = "human",
): CommandContext {
  return {
    ui: { ...ui, mode: outputMode },
    configDir: "/tmp/test-config",
    outputMode,
    isInteractive: false,
    apiBaseUrl: "https://example.invalid",
  };
}

function makeDeps(overrides?: {
  files?: readonly string[];
  metaByFile?: Record<string, { name?: string; target?: string }>;
}): FlowsListDeps {
  const { files = [], metaByFile = {} } = overrides ?? {};
  return {
    cwd: fakeCwd,
    expandPatterns: mock<FlowsListDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<FlowsListDeps["peekFlowMeta"]>((file: string) =>
      Promise.resolve({
        name: metaByFile[file]?.name,
        target: metaByFile[file]?.target,
      }),
    ),
  };
}

describe("flowsList pattern forwarding", () => {
  it("forwards undefined pattern as empty array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsList(makeCtx(), undefined, deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith([], fakeCwd);
  });

  it("forwards a string pattern as a single-element array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsList(makeCtx(), "src/auth/*.flow.ts", deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith(
      ["src/auth/*.flow.ts"],
      fakeCwd,
    );
  });
});

describe("flowsList empty match", () => {
  it("prints 'No flows matched.' via info and exits 0 in human mode", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    const result = await flowsList(makeCtx(ui, "human"), undefined, deps);

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits an empty JSON array and skips info in json mode", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    const result = await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(result).toBeUndefined();
    expect(ui.json).toHaveBeenCalledWith([]);
    expect(ui.info).not.toHaveBeenCalled();
  });
});

describe("flowsList json mode output", () => {
  it("emits a JSON array with file, name, tags, target, browser per item", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/login.flow.ts"],
      metaByFile: {
        "/proj/src/flows/login.flow.ts": {
          name: "Login",
          target: "Web - Chrome",
        },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/login.flow.ts",
        name: "Login",
        tags: [],
        target: "Web - Chrome",
        browser: "chromium",
      },
    ]);
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("falls back to basename for name when meta.name is undefined", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/checkout.flow.ts"],
      metaByFile: {
        "/proj/src/flows/checkout.flow.ts": { target: "Web - Firefox" },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/checkout.flow.ts",
        name: "checkout",
        tags: [],
        target: "Web - Firefox",
        browser: "firefox",
      },
    ]);
  });

  it("strips the .flow.js extension when falling back to basename", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/legacy.flow.js"],
      metaByFile: {
        "/proj/src/flows/legacy.flow.js": { target: "Web - Chrome" },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/legacy.flow.js",
        name: "legacy",
        tags: [],
        target: "Web - Chrome",
        browser: "chromium",
      },
    ]);
  });

  it("leaves browser undefined for an unrecognized target (e.g. Android - Pixel)", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/mobile.flow.ts"],
      metaByFile: {
        "/proj/src/flows/mobile.flow.ts": {
          name: "Mobile",
          target: "Android - Pixel",
        },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/mobile.flow.ts",
        name: "Mobile",
        tags: [],
        target: "Android - Pixel",
        browser: undefined,
      },
    ]);
  });
});

describe("flowsList human mode table", () => {
  const stripAnsi = (s: string | undefined): string =>
    (s ?? "").replace(/\[[\d;]*m/g, "");
  it("writes a bolded header + name|target|file rows; frames with intro/outro", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: [
        "/proj/src/flows/login.flow.ts",
        "/proj/src/flows/sub/checkout.flow.ts",
      ],
      metaByFile: {
        "/proj/src/flows/login.flow.ts": {
          name: "Login",
          target: "Web - Chrome",
        },
        "/proj/src/flows/sub/checkout.flow.ts": {
          name: "Checkout",
          target: "Web - Firefox",
        },
      },
    });
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);

    await flowsList(makeCtx(ui, "human"), undefined, deps);

    const output = write.mock.calls.map((c) => String(c[0])).join("");
    const lines = output.split("\n").filter((l) => l.length > 0);

    expect(lines[0]).toMatch(/^\[1mname\s+target\s+file\[0m$/);
    expect(stripAnsi(lines[1])).toMatch(
      /^Login\s+Web - Chrome\s+src\/flows\/login\.flow\.ts$/,
    );
    expect(stripAnsi(lines[2])).toMatch(
      /^Checkout\s+Web - Firefox\s+src\/flows\/sub\/checkout\.flow\.ts$/,
    );
    expect(ui.intro).toHaveBeenCalledWith("Flows");
    expect(ui.outro).toHaveBeenCalledWith("2 flows");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("renders an empty target cell with file still at the end", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/untargeted.flow.ts"],
      metaByFile: {
        "/proj/src/flows/untargeted.flow.ts": { name: "Untargeted" },
      },
    });
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);

    await flowsList(makeCtx(ui, "human"), undefined, deps);

    const output = write.mock.calls.map((c) => String(c[0])).join("");
    const lines = output.split("\n").filter((l) => l.length > 0);

    expect(stripAnsi(lines[1])).toMatch(
      /^Untargeted\s+src\/flows\/untargeted\.flow\.ts$/,
    );
  });
});
