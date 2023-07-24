export const isDefined = <T>(it: T | undefined | null): it is T => it != null;

export type Task<T> = () => T;
export type Future<T> = () => Promise<T>;

const concurrency = 12;
const pool = new Set<Promise<unknown>>();

export const mapConcurrently = async <T, R>(
  items: T[],
  predicate: (item: T, index: number) => R | Promise<R>,
): Promise<R[]> => {
  const result: Promise<R>[] = [];
  const jobs = items
    .map((item: T, index: number): Future<R> => {
      return async () => {
        return await predicate(item, index);
      };
    })
    .reverse();
  let job = jobs.pop();
  while (job) {
    if (pool.size < concurrency) {
      const promise = job();
      pool.add(promise);
      result.push(promise);
      promise.finally(() => pool.delete(promise));
      job = jobs.pop();
    } else {
      await Promise.race(pool);
    }
  }
  return await Promise.all(result);
};
