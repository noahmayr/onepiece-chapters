export const isDefined = <T>(it: T | undefined | null): it is T => it != null;

export const mapConcurrently = <T, R>(
  items: T[],
  predicate: (item: T, index: number) => R | Promise<R>,
  concurrency = 4,
): Promise<R[]> => {
  const batch: Promise<R>[] = [];
  let previous: Promise<unknown> = Promise.resolve();
  return Promise.all(
    items.map((item: T, index: number): Promise<R> => {
      if (batch.length >= concurrency) {
        previous = Promise.all(batch);
      }

      const future = async (): Promise<R> => {
        await previous;
        return await predicate(item, index);
      };

      const result = future();
      batch.push(result);
      return result;
    }),
  );
};
