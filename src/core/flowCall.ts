import { readStringLiteral } from "~/core/stringLiteral.js";

export type FlowCallMeta = {
  name: string | undefined;
  target: string | undefined;
};

// `\b` keeps `workflow(` and `myflow(` out while still allowing `obj.flow(`.
const flowCallRe = /\bflow\s*\(\s*/g;
// Sticky, so each is a check at one position rather than a search.
const argSeparatorRe = /\s*,\s*/y;
const keyValueRe = /\s*:\s*/y;
const wordChar = /\w/;

/**
 * Reads `target` from the options object opening at `start`.
 *
 * Only the object's own keys count, so a `target` in a sub-object is ignored.
 * Literals are skipped whole, so a brace or the word `target` inside a string
 * value cannot be read as structure.
 */
function readTargetFromObject(
  source: string,
  start: number,
): string | undefined {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const char = source.charAt(i);

    if (char === "{") {
      depth++;
      i++;
      continue;
    }
    if (char === "}") {
      depth--;
      if (depth === 0) return undefined;
      i++;
      continue;
    }

    const literal = readStringLiteral(source, i);
    if (literal) {
      i = literal.end + 1;
      continue;
    }

    // The required `:` rules out `targetish`, and the preceding character rules
    // out `my_target`. charAt returns "" out of range, which never matches \w.
    if (
      depth === 1 &&
      source.startsWith("target", i) &&
      !wordChar.test(source.charAt(i - 1))
    ) {
      keyValueRe.lastIndex = i + "target".length;
      if (keyValueRe.test(source)) {
        return readStringLiteral(source, keyValueRe.lastIndex)?.value;
      }
    }

    i++;
  }
  return undefined;
}

function readTarget(source: string, afterName: number): string | undefined {
  argSeparatorRe.lastIndex = afterName;
  if (!argSeparatorRe.test(source)) return undefined;

  const argStart = argSeparatorRe.lastIndex;
  if (source.charAt(argStart) === "{") {
    return readTargetFromObject(source, argStart);
  }
  // `||`, not `??`: an empty target is no more useful than a missing one.
  return readStringLiteral(source, argStart)?.value || undefined;
}

/**
 * Extracts the static name and target from the first `flow()` call that
 * supplies each.
 *
 * Name and target are resolved independently: a file whose first call omits the
 * target still reports the target of a later call. That has been the behaviour
 * since these were two separate regexes, and flows in the wild depend on it.
 */
export function parseFlowCall(source: string): FlowCallMeta {
  let name: string | undefined;
  let target: string | undefined;

  for (const match of source.matchAll(flowCallRe)) {
    const nameLiteral = readStringLiteral(
      source,
      match.index + match[0].length,
    );
    // A dynamic name hides the target too: without the end of the name there is
    // no way to find the comma that separates them.
    if (!nameLiteral) continue;

    // An empty name is reported as absent so callers fall back to the filename.
    if (name === undefined && nameLiteral.value !== "")
      name = nameLiteral.value;
    if (target === undefined) target = readTarget(source, nameLiteral.end + 1);

    if (name !== undefined && target !== undefined) break;
  }

  return { name, target };
}
