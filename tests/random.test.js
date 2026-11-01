import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../engine/random.js';

const eerste = (seed, n = 5) => { const r = mulberry32(seed); return Array.from({ length: n }, r); };

test('zelfde seed geeft dezelfde eerste 5 waarden', () => {
  assert.deepEqual(eerste(42), eerste(42));
});

test('waarden liggen in [0,1)', () => {
  for (const v of eerste(7, 1000)) assert.ok(v >= 0 && v < 1);
});

test('verschillende seeds geven verschillende reeksen', () => {
  assert.notDeepEqual(eerste(1), eerste(2));
});
