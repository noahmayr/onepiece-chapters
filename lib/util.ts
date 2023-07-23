export const isDefined = <T>(it: T | undefined | null): it is T => it != null;

export type Task<T> = () => T;
export type Future<T> = () => Promise<T>;

const concurrency = 12;
const pool = new Set<Promise<unknown>>();

export const mapConcurrently = async <T, R>(
  items: T[],
  predicate: (item: T, index: number) => R | Promise<R>,
  // concurrency = 12,
): Promise<R[]> => {
  const result: R[] = [];
  // const pool = new Set<Promise<R>>();
  const jobs = items.map((item: T, index: number): Future<R> => {
    return async () => {
      return await predicate(item, index);
    };
  });
  let job: Future<R> | undefined;
  while ((job = jobs.pop())) {
    if (pool.size < concurrency) {
      const promise = job();
      pool.add(promise);
      promise
        .then((value) => result.push(value))
        .finally(() => pool.delete(promise));
    } else {
      await Promise.race(pool);
    }
  }
  return result;
};
