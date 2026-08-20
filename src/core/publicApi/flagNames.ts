import type { FlagKind } from "./flagKind.js";

const kebabCase = (segment: string): string =>
  segment.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const capitalize = (segment: string): string =>
  `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`;

// Commander camelizes flag names, so this must mirror what Commander derives
// from `flagNameOf(path)`: camel-joining the path equals camelizing the
// kebab-joined flag name because contract field names are camelCase.
export const optionKeyOf = (path: string[]): string =>
  path
    .map((segment, index) => (index === 0 ? segment : capitalize(segment)))
    .join("");

// The bare flag name, e.g. "--environment-id". `flagUsage` appends a
// kind-specific value placeholder ("", " <value>", " <values...>", or
// " <KEY=VALUE...>") on top of this, so two fields of different kinds that
// share a name produce different `flag` strings even though Commander
// registers them under the same option. Collision detection keys on this
// name, not on `flag`, so it still catches that case.
export function flagNameOf(path: string[]): string {
  return `--${path.map(kebabCase).join("-")}`;
}

export function flagUsage(path: string[], kind: FlagKind): string {
  const name = flagNameOf(path);
  if (kind === "boolean") return name;
  if (kind === "string-array") return `${name} <values...>`;
  if (kind === "key-value-record") return `${name} <KEY=VALUE...>`;
  return `${name} <value>`;
}
