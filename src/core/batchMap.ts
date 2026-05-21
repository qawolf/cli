export async function batchMap<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  size: number,
): Promise<R[]> {
  if (size < 1) {
    throw new Error("batchMap size must be greater than 0");
  }
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}
