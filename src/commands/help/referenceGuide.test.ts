import { Command } from "commander";
import { describe, expect, it } from "bun:test";

import { renderHelpReference } from "./reference.js";
import { declareReferenceGuide } from "./referenceGuide.js";

describe("declareReferenceGuide", () => {
  it("prints the guide under the command's heading, one level below it, and keeps it out of --help", () => {
    const root = new Command("tool");
    const group = declareReferenceGuide(
      root.command("group").description("A group"),
      "Intro.\n\n## Order\n\n```sh\n# not a heading\n```",
    );
    group.command("leaf").description("A leaf");

    const reference = renderHelpReference(root, ["tool"]);

    expect(reference).toContain(
      "## tool group\n\nIntro.\n\n### Order\n\n```sh\n# not a heading\n```\n\n```text\nUsage: tool group",
    );
    expect(group.helpInformation()).not.toContain("Intro.");
  });
});
