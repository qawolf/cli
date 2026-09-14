import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";

import { formatClipboardPaths } from "./clipboardPaths.js";

describe("formatClipboardPaths", () => {
  it("keeps simple POSIX paths bare and space separated", () => {
    expect(
      formatClipboardPaths(["src/a.flow.ts", "src/b.flow.ts"], "linux"),
    ).toEqual({ text: "src/a.flow.ts src/b.flow.ts", syntax: undefined });
  });

  it("preserves POSIX carriage returns and newlines before shell invocation", () => {
    expect(
      formatClipboardPaths(
        ["src/carriage.flow.ts\r", "src/first\nsecond.flow.ts"],
        "linux",
      ),
    ).toEqual({
      text: "'src/carriage.flow.ts\r' 'src/first\nsecond.flow.ts'",
      syntax: undefined,
    });
  });

  it("keeps simple Windows paths bare", () => {
    expect(formatClipboardPaths(["C:\\flows\\a.flow.ts"], "win32")).toEqual({
      text: "C:\\flows\\a.flow.ts",
      syntax: undefined,
    });
  });

  it("labels PowerShell syntax when Windows paths need quoting", () => {
    expect(
      formatClipboardPaths(
        ["C:\\flows\\customer's cart.flow.ts", "src/flows/payments[1].flow.ts"],
        "win32",
      ),
    ).toEqual({
      text: "'C:\\flows\\customer''s cart.flow.ts' 'src/flows/payments[1].flow.ts'",
      syntax: "PowerShell syntax",
    });
  });

  it("quotes PowerShell expressions, cmd expansions, and smart apostrophes literally", () => {
    expect(
      formatClipboardPaths(
        [
          "src/$env:USERNAME.flow.ts",
          "src/`Write-Output injected`.flow.ts",
          "src/$(Write-Output injected).flow.ts",
          "src/%USERNAME%!flow!.ts",
          "src/it’s ‘quoted‚‛.flow.ts",
          "src/first\nsecond.flow.ts",
        ],
        "win32",
      ),
    ).toEqual({
      text: "'src/$env:USERNAME.flow.ts' 'src/`Write-Output injected`.flow.ts' 'src/$(Write-Output injected).flow.ts' 'src/%USERNAME%!flow!.ts' 'src/it’’s ‘‘quoted‚‚‛‛.flow.ts' 'src/first\nsecond.flow.ts'",
      syntax: "PowerShell syntax",
    });
  });

  it("defaults to the current platform's clipboard format", () => {
    const paths = ["src/it's a flow.ts"];
    expect(formatClipboardPaths(paths)).toEqual(
      formatClipboardPaths(paths, process.platform),
    );
  });

  it.skipIf(
    spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"]).error !== undefined,
  )("round trips quoted paths through PowerShell when installed", () => {
    const paths = [
      "C:\\flows\\a.flow.ts",
      "C:\\flows\\customer's cart.flow.ts",
      "src/$(Write-Output injected).flow.ts",
      "src/`Write-Output injected`.flow.ts",
      "src/%USERNAME%!flow!.ts",
      "src/it’s ‘quoted‚‛.flow.ts",
      "src/first\nsecond.flow.ts",
      "#comment.flow.ts",
      "~/literal.flow.ts",
    ];
    const { text } = formatClipboardPaths(paths, "win32");
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `function Read-Arguments { ConvertTo-Json -Compress -InputObject $args }; Read-Arguments ${text}`,
      ],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const actual: unknown = JSON.parse(result.stdout);
    expect(actual).toEqual(paths);
  });
});
