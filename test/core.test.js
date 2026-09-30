import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMemo } from '../src/index.js';

describe('createMemo', () => {
  test('returns the cached result on a repeated call', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x * 2; },
      (args) => args[0],
      3
    );
    assert.equal(memo(5), 10);
    assert.equal(memo(5), 10);
    assert.equal(calls, 1);
  });

  test('distinguishes keys produced by keyFn', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x; },
      (args) => args[0],
      3
    );
    assert.equal(memo(1), 1);
    assert.equal(memo(2), 2);
    assert.equal(calls, 2);
  });

  test('evicts the least-recently-used entry when full', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x; },
      (args) => args[0],
      2
    );
    memo(1); // cache: [1]
    memo(2); // cache: [1, 2]
    memo(1); // hit on 1, cache order: [2, 1]
    memo(3); // evict 2 (LRU), cache: [1, 3]
    assert.equal(memo(1), 1); // still cached
    assert.equal(memo(2), 2); // recomputed, 2 was evicted
    assert.equal(calls, 4); // 1, 2, 3, and the recompute of 2
  });

  test('maxSize of 0 disables caching entirely', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x; },
      (args) => args[0],
      0
    );
    assert.equal(memo(1), 1);
    assert.equal(memo(1), 1);
    assert.equal(calls, 2);
    assert.equal(memo.cache.size, 0);
  });

  test('keyFn receives the arguments array', () => {
    let captured;
    const memo = createMemo(
      (a, b) => a + b,
      (args) => { captured = args; return args[0] + ':' + args[1]; },
      3
    );
    memo('x', 'y');
    assert.deepEqual(captured, ['x', 'y']);
  });

  test('throws if fn is not a function', () => {
    assert.throws(
      () => createMemo(null, () => 0, 1),
      { name: 'TypeError' }
    );
  });

  test('throws if keyFn is not a function', () => {
    assert.throws(
      () => createMemo(() => 0, null, 1),
      { name: 'TypeError' }
    );
  });

  test('throws if maxSize is not a non-negative integer', () => {
    assert.throws(() => createMemo(() => 0, () => 0, -1), { name: 'TypeError' });
    assert.throws(() => createMemo(() => 0, () => 0, 1.5), { name: 'TypeError' });
    assert.throws(() => createMemo(() => 0, () => 0, '3'), { name: 'TypeError' });
  });

  test('clear() empties the cache', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x; },
      (args) => args[0],
      3
    );
    memo(1);
    memo(2);
    assert.equal(memo.cache.size, 2);
    memo.clear();
    assert.equal(memo.cache.size, 0);
    memo(1); // recomputed after clear
    assert.equal(calls, 3);
  });

  test('a read promotes the entry to most-recently-used', () => {
    let calls = 0;
    const memo = createMemo(
      (x) => { calls++; return x; },
      (args) => args[0],
      3
    );
    memo(1); // [1]
    memo(2); // [1, 2]
    memo(3); // [1, 2, 3]
    memo(1); // hit: [2, 3, 1]
    memo(4); // evict 2: [3, 1, 4]
    assert.equal(memo(2), 2); // recomputed, evicts 3: [1, 4, 2]
    assert.equal(memo(3), 3); // recomputed, 3 was evicted by the insert of 2
    assert.equal(calls, 6); // 1,2,3,4, and recompute of 2 and 3
  });

  test('preserves `this` binding when called as a method', () => {
    const obj = {
      base: 100,
      method: createMemo(
        function (x) { return this.base + x; },
        (args) => args[0],
        3
      ),
    };
    assert.equal(obj.method(5), 105);
    assert.equal(obj.method(5), 105);
  });

  test('does not cache when fn throws', () => {
    let calls = 0;
    const memo = createMemo(
      () => { calls++; throw new Error('boom'); },
      (args) => args[0],
      3
    );
    assert.throws(() => memo(1), { message: 'boom' });
    assert.throws(() => memo(1), { message: 'boom' });
    assert.equal(calls, 2);
    assert.equal(memo.cache.size, 0);
  });

  test('supports symbol keys', () => {
    let calls = 0;
    const symA = Symbol('a');
    const memo = createMemo(
      (s) => { calls++; return s; },
      (args) => args[0],
      2
    );
    assert.equal(memo(symA), symA);
    assert.equal(memo(symA), symA);
    assert.equal(calls, 1);
  });
});
