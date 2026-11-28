import { Option, type Command } from "commander";

import type { CommandSpec } from "~/domains/publicApi/commandSpecs.js";
import {
  answersWithImage,
  imageOutputFileOption,
} from "~/domains/publicApi/imageOutputFile.js";

import { optionEnvironmentVariable } from "./environmentOptions.js";

export function addSpecOptions(command: Command, spec: CommandSpec): void {
  for (const flag of spec.flags) {
    const environmentVariable = optionEnvironmentVariable(spec, flag.path);
    if (environmentVariable) {
      const option = new Option(flag.flag, flag.description).env(
        environmentVariable,
      );
      if (flag.required) option.makeOptionMandatory();
      command.addOption(option);
    } else if (flag.required) {
      command.requiredOption(flag.flag, flag.description);
    } else {
      command.option(flag.flag, flag.description);
    }
  }
  if (answersWithImage(spec.contract))
    command.option(
      imageOutputFileOption.flag,
      imageOutputFileOption.description,
    );
}
