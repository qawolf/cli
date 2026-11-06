import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, posix, sep } from "node:path";

import type { Fs } from "~/shell/fs.js";

import {
  fileExtensionByMediaType,
  type ImageMediaType,
  isImageMediaType,
} from "./imageMediaTypes.js";

const imageDirectory = join(tmpdir(), "qawolf-issue-images");

const markdownDataImage =
  /!\[((?:\\.|[^\\\]])*)\]\(data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})\)/g;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (isPlainObject(value)) return Object.values(value).flatMap(collectStrings);
  return [];
}

function mapStrings({
  map,
  value,
}: {
  map: (text: string) => string;
  value: unknown;
}): unknown {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value))
    return value.map((item) => mapStrings({ map, value: item }));
  if (isPlainObject(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapStrings({ map, value: item }),
      ]),
    );
  return value;
}

function markdownDestination(path: string): string {
  const forwardSlashPath = path.split(sep).join(posix.sep);
  return /[\s()<>]/.test(forwardSlashPath)
    ? `<${forwardSlashPath}>`
    : forwardSlashPath;
}

async function writeImageFile({
  base64,
  fs,
  mediaType,
}: {
  base64: string;
  fs: Fs;
  mediaType: ImageMediaType;
}): Promise<string | undefined> {
  const bytes = Buffer.from(base64, "base64");
  const name = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const path = join(
    imageDirectory,
    `${name}.${fileExtensionByMediaType[mediaType]}`,
  );
  try {
    await fs.mkdir(imageDirectory, { recursive: true });
    await fs.writeFile(path, bytes);
    return path;
  } catch {
    return undefined;
  }
}

export async function saveDataImagesAsFiles({
  fs,
  value,
}: {
  fs: Fs;
  value: unknown;
}): Promise<unknown> {
  const images = new Map(
    collectStrings(value)
      .flatMap((text) => [...text.matchAll(markdownDataImage)])
      .flatMap(([, , mediaType, base64]): [string, ImageMediaType][] =>
        mediaType !== undefined &&
        base64 !== undefined &&
        isImageMediaType(mediaType)
          ? [[base64, mediaType]]
          : [],
      ),
  );
  const paths = new Map(
    await Promise.all(
      [...images].map(
        async ([base64, mediaType]): Promise<[string, string | undefined]> => [
          base64,
          await writeImageFile({ base64, fs, mediaType }),
        ],
      ),
    ),
  );
  return mapStrings({
    map: (text) =>
      text.replace(
        markdownDataImage,
        (whole: string, alt: string, _mediaType: string, base64: string) => {
          const path = paths.get(base64);
          return path === undefined
            ? whole
            : `![${alt}](${markdownDestination(path)})`;
        },
      ),
    value,
  });
}
