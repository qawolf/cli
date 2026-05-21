export const flowBatchSize = 32;

export async function* batchMap<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  size: number,
): AsyncGenerator<R> {
  if (size < 1) {
    throw new Error("batchMap size must be greater than 0");
  }
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.all(batch.map(fn));
    for (const result of results) {
      yield result;
    }
  }
}
