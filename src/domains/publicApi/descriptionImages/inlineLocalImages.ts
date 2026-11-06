import { posix, win32 } from "node:path";
import { buffer } from "node:stream/consumers";

import type { Fs } from "~/shell/fs.js";

import { mediaTypeOf } from "./imageMediaTypes.js";

const markdownImage =
  /!\[((?:\\.|[^\\\]])*)\]\((?:<([^<>\n]+)>|([^\s()<>]+))\)/g;

type LocalImage =
  | { dataUrl: string; path: string; type: "image" }
  | { path: string; type: "missing" | "not-an-image" };

async function readLocalImage({
  fs,
  path,
}: {
  fs: Fs;
  path: string;
}): Promise<LocalImage> {
  const stat = await fs.stat(path).catch(() => undefined);
  if (stat === undefined || !stat.isFile()) return { path, type: "missing" };
  const bytes = await buffer(fs.createReadStream(path));
  const mediaType = mediaTypeOf(bytes);
  if (mediaType === undefined) return { path, type: "not-an-image" };
  return {
    dataUrl: `data:${mediaType};base64,${bytes.toString("base64")}`,
    path,
    type: "image",
  };
}

function refusalOf({
  path,
  type,
}: Exclude<LocalImage, { type: "image" }>): string {
  switch (type) {
    case "missing":
      return `No image file at ${path}.`;
    case "not-an-image":
      return `${path} is not a GIF, JPEG, PNG or WebP image.`;
  }
}

const isLocalPath = (source: string): boolean =>
  posix.isAbsolute(source) || win32.isAbsolute(source);

const sourceOf = (match: RegExpMatchArray): string | undefined =>
  match[2] ?? match[3];

async function inlineLocalImages({
  fs,
  markdown,
}: {
  fs: Fs;
  markdown: string;
}): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  const paths = [
    ...new Set(
      [...markdown.matchAll(markdownImage)]
        .map(sourceOf)
        .filter(
          (source): source is string =>
            source !== undefined && isLocalPath(source),
        ),
    ),
  ];
  const images = await Promise.all(
    paths.map((path) => readLocalImage({ fs, path })),
  );
  const refusals = images.flatMap((image) =>
    image.type === "image" ? [] : [refusalOf(image)],
  );
  if (refusals.length > 0) return { ok: false, error: refusals.join(" ") };

  const dataUrls = new Map(
    images.flatMap((image): [string, string][] =>
      image.type === "image" ? [[image.path, image.dataUrl]] : [],
    ),
  );
  return {
    ok: true,
    markdown: markdown.replace(
      markdownImage,
      (whole: string, alt: string, bracketed?: string, bare?: string) => {
        const source = bracketed ?? bare;
        const dataUrl = source === undefined ? undefined : dataUrls.get(source);
        return dataUrl === undefined ? whole : `![${alt}](${dataUrl})`;
      },
    ),
  };
}

export async function inlineDescriptionImages({
  fs,
  input,
}: {
  fs: Fs;
  input: Record<string, unknown>;
}): Promise<
  { ok: true; input: Record<string, unknown> } | { ok: false; error: string }
> {
  const { description } = input;
  if (typeof description !== "string") return { ok: true, input };
  const inlined = await inlineLocalImages({ fs, markdown: description });
  if (!inlined.ok) return inlined;
  return { ok: true, input: { ...input, description: inlined.markdown } };
}
