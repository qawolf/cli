// Case and separators are presentation, not identity: a group folder named
// `smoke-tests` is shown as "Smoke Tests" in the map UI, so both spellings
// have to collapse to the same thing before comparing.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  // Single-row Levenshtein: `row[j]` is the distance from a[0..i] to b[0..j].
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = (row[j] ?? 0) + 1;
      const insertion = (next[j - 1] ?? 0) + 1;
      next.push(Math.min(substitution, deletion, insertion));
    }
    row = next;
  }
  return row[b.length] ?? 0;
}

// One edit is a plausible slip on any name; two only stops being noise once
// the name is long enough that two edits still leave it recognizable.
function distanceBudget(length: number): number {
  return length >= 4 ? 2 : 1;
}

/**
 * Finds the candidate a mistyped name most likely meant, or undefined when
 * none is close enough to be worth suggesting.
 *
 * Matching stays strict elsewhere — this only powers "did you mean" hints, so
 * a loose hit here never silently selects anything.
 */
export function suggestNearMiss(
  input: string,
  candidates: readonly string[],
): string | undefined {
  if (candidates.includes(input)) return undefined;

  // Sorted so a tie between equally-close candidates resolves the same way on
  // every run rather than following the order the API returned them in.
  const sorted = [...candidates].sort();
  const normalizedInput = normalize(input);

  const presentationMatch = sorted.find(
    (candidate) => normalize(candidate) === normalizedInput,
  );
  if (presentationMatch !== undefined) return presentationMatch;

  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of sorted) {
    const distance = editDistance(normalizedInput, normalize(candidate));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= distanceBudget(normalizedInput.length)
    ? best
    : undefined;
}
