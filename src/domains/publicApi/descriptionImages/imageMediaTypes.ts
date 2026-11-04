export const fileExtensionByMediaType = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageMediaType = keyof typeof fileExtensionByMediaType;

export const isImageMediaType = (value: string): value is ImageMediaType =>
  Object.hasOwn(fileExtensionByMediaType, value);

export function mediaTypeOf(bytes: Buffer): ImageMediaType | undefined {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from("\x89PNG\r\n\x1a\n", "latin1")))
    return "image/png";
  if (bytes.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "image/webp";
  return undefined;
}
