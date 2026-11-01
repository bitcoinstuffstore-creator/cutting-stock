import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakPacker, EPS } from '../engine/packers.js';
import { mulberry32 } from '../engine/random.js';

for (const soort of ['guillotine', 'maxrects']) {
  test(`${soort}: drie naast elkaar`, () => {
    const p = maakPacker(soort, 300, 1000);
    const r = [0, 1, 2].map(() => p.plaats(100, 200, false));
    assert.ok(r.every((x) => x && x.y === 0));
    assert.deepEqual(r.map((x) => x.x).sort((a, b) => a - b), [0, 100, 200]);
  });

  test(`${soort}: exact fit`, () => {
    const p = maakPacker(soort, 250, 1000);
    assert.notEqual(p.plaats(250, 100, false), null);
  });

  test(`${soort}: te breed`, () => {
    const p = maakPacker(soort, 120, 1000);
    assert.equal(p.plaats(121, 10, false), null);
    const r = p.plaats(121, 10, true);
    assert.equal(r.gedraaid, true);
    assert.equal(r.w, 10);
    assert.equal(r.h, 121);
  });

  test(`${soort}: te lang`, () => {
    const p = maakPacker(soort, 300, 100);
    assert.equal(p.plaats(10, 101, false), null);
  });

  test(`${soort}: mislukte plaats muteert niets`, () => {
    const p = maakPacker(soort, 100, 100);
    assert.equal(p.plaats(101, 101, true), null);
    assert.notEqual(p.plaats(100, 100, false), null);
  });

  test(`${soort}: invarianten`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rnd = mulberry32(seed);
      const p = maakPacker(soort, 300, 3000);
      const out = [];
      for (let i = 0; i < 40; i++) {
        const w = 20 + rnd() * 130;
        const h = 20 + rnd() * 280;
        const r = p.plaats(w, h, rnd() < 0.5);
        if (r) out.push(r);
      }
      assert.ok(out.length > 0);
      for (const a of out) {
        assert.ok(a.x >= -EPS && a.y >= -EPS);
        assert.ok(a.x + a.w <= 300 + EPS && a.y + a.h <= 3000 + EPS);
      }
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const a = out[i], b = out[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          assert.ok(!(ox > 0 && oy > 0 && ox * oy > EPS), `overlap seed ${seed}`);
        }
      }
    }
  });
}

test('maxrects bottom-left', () => {
  const p = maakPacker('maxrects', 300, 1000);
  p.plaats(200, 100, false);
  const r = p.plaats(200, 50, false);
  assert.equal(r.y, 100);
  assert.equal(r.x, 0);
});
