import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nestStof, nestMetStrategie, STRATEGIEEN } from '../engine/nesting.js';
import { EPS } from '../engine/packers.js';
import { mulberry32 } from '../engine/random.js';

const R = { code: 'R', rolbreedte: 320, rollengte: 30, draaienToegestaan: true };
const T = { code: 'T', rolbreedte: 120, rollengte: 40, draaienToegestaan: false };
const inst = { snijspeling: 0 };
let teller = 0;
const stuk = (w, h, magDraaien = true, extra = {}) => {
  const id = `s${++teller}`;
  return { id, doekId: id, orderNr: 'O', product: 'P', stof: 'R', w, h, magDraaien, vastGedraaid: false, baan: null, ...extra };
};
const vi = (id, soort, breedte, lengte, stof = 'R') => ({ id, stof, soort, breedte, lengte });

test('STRATEGIEEN: 8 namen in vaste volgorde', () => {
  assert.equal(STRATEGIEEN.length, 8);
  assert.equal(STRATEGIEEN[0], 'guillotine/oppervlak');
  assert.equal(STRATEGIEEN[3], 'guillotine/langsteZijde');
  assert.equal(STRATEGIEEN[4], 'maxrects/oppervlak');
  assert.equal(STRATEGIEEN[7], 'maxrects/langsteZijde');
});

test('bakvolgorde: kortste reststuk eerst', () => {
  const voorraad = [vi('rs1', 'reststuk', 320, 300), vi('rs2', 'reststuk', 320, 150), vi('r1', 'rol', 320, 3000)];
  const res = nestStof([stuk(100, 100)], R, voorraad, inst);
  assert.deepEqual(res.bakken.map((b) => b.id), ['rs2', 'rs1', 'r1']);
  const bak = res.bakken.find((b) => b.plaatsingen.length);
  assert.equal(bak.id, 'rs2');
  assert.equal(bak.gebruikteLengte, 100);
  assert.equal(res.bakken.find((b) => b.id === 'r1').gebruikteLengte, 0);
});

test('reststuk te smal', () => {
  const voorraad = [vi('rs', 'reststuk', 80, 500), vi('r1', 'rol', 320, 3000)];
  const res = nestStof([stuk(100, 100, false)], R, voorraad, inst);
  assert.equal(res.bakken.find((b) => b.id === 'rs').plaatsingen.length, 0);
  assert.equal(res.bakken.find((b) => b.id === 'r1').plaatsingen.length, 1);
});

test('voorraad voor nieuw', () => {
  const a = nestStof([stuk(100, 100)], R, [vi('r1', 'rol', 320, 3000)], inst);
  assert.equal(a.nieuweRollen, 0);
  const b = nestStof([stuk(100, 100)], R, [], inst);
  assert.equal(b.nieuweRollen, 1);
  assert.equal(b.bakken[0].id, 'nieuw-1');
  assert.equal(b.bakken[0].soort, 'nieuw');
  assert.equal(b.bakken[0].lengte, 3000);
  assert.equal(b.bakken[0].breedte, 320);
  assert.equal(b.bakken[0].voorraadId, null);
});

test('nieuwe rol bij vol', () => {
  const stukken = Array.from({ length: 11 }, () => stuk(320, 300, false));
  const res = nestStof(stukken, R, [], inst);
  assert.equal(res.nieuweRollen, 2);
  assert.equal(res.onplaatsbaar.length, 0);
});

test('onplaatsbaar', () => {
  const res = nestStof([stuk(400, 100, false)], R, [], inst);
  assert.equal(res.onplaatsbaar.length, 1);
  assert.equal(res.nieuweRollen, 0);
  assert.equal(res.bakken.length, 0);
});

test('geen draaien', () => {
  // Reststuk 105 breed: 110x100 past daar alleen gedraaid (100x110).
  const voorraad = [vi('rs', 'reststuk', 105, 500, 'T')];
  const vast = nestStof([stuk(110, 100, false, { stof: 'T' })], T, voorraad, inst);
  const plV = vast.bakken.flatMap((b) => b.plaatsingen);
  assert.equal(plV.length, 1);
  assert.equal(plV[0].gedraaid, false);
  assert.equal(vast.bakken.find((b) => b.id === 'rs').plaatsingen.length, 0);
  assert.equal(vast.nieuweRollen, 1);
  // Controle: met magDraaien true wordt wel gedraaid in het reststuk.
  const vrij = nestStof([stuk(110, 100, true, { stof: 'T' })], T, voorraad, inst);
  const rs = vrij.bakken.find((b) => b.id === 'rs');
  assert.equal(rs.plaatsingen.length, 1);
  assert.equal(rs.plaatsingen[0].gedraaid, true);
  assert.equal(rs.plaatsingen[0].w, 100);
  assert.equal(rs.plaatsingen[0].h, 110);
});

test('speling', () => {
  const mk = () => [stuk(159, 100, false), stuk(159, 100, false)];
  const met = nestStof(mk(), R, [], { snijspeling: 2 });
  const ys = met.bakken[0].plaatsingen.map((p) => p.y);
  assert.notEqual(ys[0], ys[1]);
  assert.ok(met.bakken[0].plaatsingen.every((p) => p.w === 159 && p.h === 100));
  assert.equal(met.bakken[0].gebruikteLengte, 202);
  const zonder = nestStof(mk(), R, [], { snijspeling: 0 });
  assert.deepEqual(zonder.bakken[0].plaatsingen.map((p) => p.y), [0, 0]);
});

test('deterministisch', () => {
  const mk = () => { teller = 0; return [stuk(100, 200), stuk(150, 80), stuk(60, 300), stuk(310, 40)]; };
  const v = [vi('rs', 'reststuk', 320, 200)];
  assert.deepEqual(nestStof(mk(), R, v, inst), nestStof(mk(), R, v, inst));
});

test('kiest beste', () => {
  teller = 0;
  const stukken = [stuk(100, 200), stuk(150, 80), stuk(60, 300), stuk(310, 40), stuk(200, 120), stuk(90, 90)];
  const voorraad = [vi('rs', 'reststuk', 320, 250)];
  const res = nestStof(stukken, R, voorraad, inst);
  assert.ok(STRATEGIEEN.includes(res.strategie));
  const som = (r) => r.bakken.reduce((a, b) => a + b.gebruikteLengte, 0);
  for (const naam of STRATEGIEEN) {
    const r = nestMetStrategie(stukken, R, voorraad, inst, naam);
    assert.ok(r.nieuweRollen > res.nieuweRollen || (r.nieuweRollen === res.nieuweRollen && som(res) <= som(r) + EPS));
  }
});

test('invarianten', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = mulberry32(seed);
    const n = 30 + Math.floor(r() * 51);
    const stukken = Array.from({ length: n }, () => {
      const w = 20 + Math.floor(r() * 280);
      const h = 20 + Math.floor(r() * 280);
      return stuk(w, h, r() < 0.6);
    });
    const voorraad = [];
    const nv = Math.floor(r() * 4);
    for (let i = 0; i < nv; i++) {
      voorraad.push(vi(`v${i}`, r() < 0.5 ? 'reststuk' : 'rol', 100 + Math.floor(r() * 220), 200 + Math.floor(r() * 1500)));
    }
    const res = nestStof(stukken, R, voorraad, inst);
    assert.equal(res.onplaatsbaar.length, 0);
    const gezien = new Map();
    for (const bak of res.bakken) {
      for (const p of bak.plaatsingen) gezien.set(p.stukId, (gezien.get(p.stukId) ?? 0) + 1);
      for (const p of bak.plaatsingen) {
        assert.ok(p.x >= -EPS && p.y >= -EPS && p.x + p.w <= bak.breedte + EPS && p.y + p.h <= bak.lengte + EPS, `buiten bak (seed ${seed})`);
        const s = stukken.find((x) => x.id === p.stukId);
        if (!s.magDraaien) assert.equal(p.gedraaid, false);
      }
      for (let i = 0; i < bak.plaatsingen.length; i++) for (let j = i + 1; j < bak.plaatsingen.length; j++) {
        const a = bak.plaatsingen[i], b = bak.plaatsingen[j];
        const overlap = a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
        assert.ok(!overlap, `overlap (seed ${seed})`);
      }
    }
    assert.equal(gezien.size, n);
    assert.ok([...gezien.values()].every((c) => c === 1));
  }
});
