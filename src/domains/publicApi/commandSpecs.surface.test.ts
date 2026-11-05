import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { buildCommandSpecs } from "./commandSpecs.js";
import { skippedContractNames, skippedFlagPaths } from "./skippedContracts.js";

// Every generated command's flags, built from the installed contracts. A
// contract update that changes any flag, such as a field turning from
// per-leaf flags into one JSON flag, shows up here as a snapshot diff.
describe("generated command surface", () => {
  it("matches the flags generated from the installed contracts", () => {
    const specs = buildCommandSpecs(publicContractsV1, {
      skipContractNames: skippedContractNames,
      skipFlagPaths: skippedFlagPaths,
    });

    const surface = Object.fromEntries(
      specs.map((spec) => [
        spec.commandPath.join(" "),
        spec.flags.map(
          (flag) =>
            `${flag.flag} (${flag.kind}${flag.required ? ", required" : ""})`,
        ),
      ]),
    );

    expect(surface).toMatchSnapshot();
  });
});
