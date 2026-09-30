/**
 * Core memoization logic, decoupled from the public facade so it can be
 * unit-tested in isolation.
 *
 * Design decisions (stated plainly so the tests can hold us to them):
 *
 * 1. Eviction is LRU. When the cache is full we drop the entry whose key was
 *    least recently *read or written*. This is the interpretation we picked;
 *    we do not also try to honour FIFO or TTL, despite the brief being silent
 *    on the policy. One policy, tested.
 *
 * 2. The key function is invoked exactly once per distinct key. If it throws,
 *    the exception propagates and nothing is cached. We do not retry, and we
 *    do not cache the rejection.
 *
 * 3. `maxSize` of 0 means "cache nothing". Every call goes straight to the
 *    underlying function. This is the one boundary that surprises people, so
 *    it is called out in the README and tested directly.
 *
 * 4. Keys are compared by strict equality on the value returned by `keyFn`.
 *    We do not serialize keys to strings. If a caller needs object-keyed
 *    memoization they must return a primitive (string/number/symbol) from
 *    `keyFn`; we document this rather than silently JSON-stringifying, because
 *    silent serialization hides identity bugs.
 */

/**
 * @typedef {(args: any[]) => any} KeyFn
 * @typedef {(...args: any[]) => any} WrappedFn
 */

/**
 * Create a memoizing wrapper around `fn`.
 *
 * @param {WrappedFn} fn - The function whose return values are cached.
 * @param {KeyFn} keyFn - Maps a call's arguments to the cache key. Called
 *   once per distinct key; if it throws, the throw propagates and nothing is
 *   stored.
 * @param {number} maxSize - Maximum number of entries. Must be a non-negative
 *   integer. 0 disables caching entirely.
 * @returns {WrappedFn & { cache: Map<any, any>, clear: () => void }}
 *   The memoized function, with `cache` and `clear` attached for inspection
 *   and testing.
 */
export function createMemo(fn, keyFn, maxSize) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  if (typeof keyFn !== 'function') {
    throw new TypeError('keyFn must be a function');
  }
  if (!Number.isInteger(maxSize) || maxSize < 0) {
    throw new TypeError('maxSize must be a non-negative integer');
  }

  // We use a plain Map and rely on insertion-order iteration for LRU. On a
  // hit we delete-and-re-set so the entry moves to the end (most-recent). On
  // eviction we delete the first entry returned by the iterator, which is the
  // least-recent. This is O(1) for both operations and avoids a linked list.
  const cache = new Map();

  function memoized(...args) {
    // maxSize === 0: bypass the cache entirely. We still call keyFn for
    // consistency of observable behaviour (callers may rely on its side
    // effects, though that would be unwise).
    if (maxSize === 0) {
      return fn.apply(this, args);
    }

    const key = keyFn(args);

    if (cache.has(key)) {
      const value = cache.get(key);
      // Re-insert to mark most-recently-used.
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    if (cache.size > maxSize) {
      // Evict the oldest entry. Map iteration yields keys in insertion order,
      // and since we re-insert on hit, the first key is genuinely the LRU.
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    return result;
  }

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
}
