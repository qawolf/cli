export type SnapshotSerialization = { html: unknown; truncated: boolean };

const truncationMarker = "[TRUNCATED]";

export class BoundedJsonWriter {
  truncated = false;
  get remainingBytes() {
    return this.#maxBytes - this.#length;
  }
  readonly #chunks: string[] = [];
  #length = 0;

  readonly #maxBytes: number;

  constructor(maxBytes: number) {
    this.#maxBytes = Math.max(0, maxBytes);
  }

  append(value: string): boolean {
    const bytes = Buffer.byteLength(value);
    if (bytes > this.remainingBytes) {
      this.truncated = true;
      return false;
    }
    this.#chunks.push(value);
    this.#length += bytes;
    return true;
  }

  finish(): SnapshotSerialization {
    const serialized = this.#chunks.join("");
    if (!this.truncated)
      return { html: JSON.parse(serialized || "null"), truncated: false };
    if (this.#maxBytes <= Buffer.byteLength(truncationMarker)) {
      return {
        html: truncationMarker.slice(0, this.#maxBytes),
        truncated: true,
      };
    }
    const contentBytes = this.#maxBytes - Buffer.byteLength(truncationMarker);
    let prefix = Buffer.from(serialized).subarray(0, contentBytes).toString();
    while (Buffer.byteLength(prefix) > contentBytes)
      prefix = prefix.slice(0, -1);
    return { html: `${prefix}${truncationMarker}`, truncated: true };
  }

  stop() {
    this.truncated = true;
  }
}
