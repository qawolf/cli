import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import type { Fs } from "~/shell/fs.js";
import { isJpeg } from "~/shell/interactiveRunner/writeScreenshot.js";

export const imageOutputFileOption = {
  description:
    "Write the image to this file as a JPEG, refusing to overwrite an existing file, and print the rest of the answer without its base64",
  flag: "--output-file <path>",
};

type SavedImage =
  | { ok: true; answer: unknown }
  | { ok: false; failure: Exclude<CommandResult, void> };

export function answersWithImage(contract: AnyPublicApiContract): boolean {
  return (
    contract.output instanceof z.ZodObject &&
    "imageJpegBase64" in contract.output.shape
  );
}

export function requestedImageOutputFile(
  contract: AnyPublicApiContract,
  options: Record<string, unknown>,
): string | undefined {
  const { outputFile } = options;
  return answersWithImage(contract) && typeof outputFile === "string"
    ? outputFile
    : undefined;
}

export function refusedOverwrite(
  outputFile: string,
): Exclude<CommandResult, void> {
  return {
    error: `Refusing to overwrite existing file: ${outputFile}`,
    exitCode: exitCodes.invalidArgs,
  };
}

export async function saveRequestedImage(
  fs: Pick<Fs, "writeFileExclusive">,
  options: { answer: unknown; outputFile: string | undefined },
): Promise<SavedImage> {
  const { answer, outputFile } = options;
  if (outputFile === undefined) return { answer, ok: true };
  if (
    typeof answer !== "object" ||
    answer === null ||
    !("imageJpegBase64" in answer) ||
    typeof answer.imageJpegBase64 !== "string"
  )
    return {
      failure: {
        error: "The answer carried no image to write.",
        exitCode: exitCodes.network,
      },
      ok: false,
    };
  const { imageJpegBase64, ...rest } = answer;
  const bytes = Buffer.from(imageJpegBase64, "base64");
  if (!isJpeg(bytes))
    return {
      failure: {
        error: "The answer's image is not a JPEG, so nothing was written.",
        exitCode: exitCodes.network,
      },
      ok: false,
    };
  const written = await fs.writeFileExclusive(outputFile, bytes, {
    mode: 0o600,
  });
  if (!written) return { failure: refusedOverwrite(outputFile), ok: false };
  return { answer: { ...rest, outputFile }, ok: true };
}
