# memoize

A small ESM library that caches a function's return values, keyed by a function you supply, with a fixed-size LRU cap.

## Usage

```js
import { createMemo } from './src/index.js';

const expensive = (n) => n * n;
const memo = createMemo(
  expensive,
  (args) => args[0],          // key derived from the call's arguments
  100                          // keep at most 100 results
);

memo(4); // 16, computed
memo(4); // 16, from cache
memo.clear();
```

## Why

Repeated calls to a pure function with the same arguments waste work. This library gives you one knob — a maximum entry count — and one obligation: write a `keyFn` that turns a call's arguments into a stable primitive key. The trade-off is that we do not serialize keys for you. If your key function returns an object, two calls that look identical will miss the cache because objects compare by identity. Return a string, number, or symbol and you are fine. This is deliberate; silently JSON-stringifying keys hides identity bugs that are worse than a cold cache.

## Edge cases

- **`maxSize` of 0** disables caching. Every call goes straight to the underlying function. Useful for tests or for turning caching off without changing call sites.
- **Eviction is LRU.** Both reads and writes promote an entry to most-recently-used. When the cache exceeds `maxSize`, the least-recently-used entry is dropped.
- **If the underlying function throws, nothing is cached.** The next call with the same key will invoke the function again.
- **`keyFn` is called once per distinct key.** If it throws, the exception propagates and nothing is stored.

## Exports

- `createMemo(fn, keyFn, maxSize)` — returns a function with the same signature as `fn`, plus a `cache` property (the underlying `Map`) and a `clear()` method.

## Running the tests

```
node --test
```
