/**
 * Run an async mapper over items with a bounded number in flight at once.
 * Preserves input order in the results. Never throws for an individual item —
 * the mapper itself is expected to be failure-tolerant (return null on error).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await mapper(items[i], i);
      } catch (err) {
        // A throwing mapper must not abort the pool or detach the other workers.
        console.error("[concurrency] mapper threw for item", i, err);
        results[i] = null as R;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length || 1) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * fetch() with a hard timeout so one hung upstream connection can't consume the
 * whole serverless function budget. Throws on timeout (caller handles).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
