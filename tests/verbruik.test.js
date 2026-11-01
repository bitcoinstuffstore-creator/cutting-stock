import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berekenVerbruik } from '../engine/verbruik.js';
import { nestStof } from '../engine/nesting.js';
import { mulberry32 } from '../engine/random.js';

const R = { code: 'R', rolbreedte: 320, rollengte: 30, draaienToegestaan: true };
const inst = { snijspeling: 0, minReststukLengte: 50 };
const pl = (doekId, w, h, i = 0) => ({ stukId: `${doekId}/${i}`, doekId, x: 0, y: 0, w, h, gedraaid: false });
const bak = (id, breedte, lengte, plaatsingen, gebruikteLengte) => ({ id, soort: 'rol', voorraadId: id, breedte, lengte, plaatsingen, gebruikteLengte });
const nest = (bakken) => ({ bakken, strategie: 'x', nieuweRollen: 0, onplaatsbaar: [] });
const doek = (doekId) => ({ doekId, orderNr: 'O-' + doekId, datum: '2026-01-01', product: 'P', stof: 'R', breedte: 0, hoogte: 0, snijB: 0, snijH: 0, nettoM2: 0 });

test('restlengte verlies', () => {
  const v = berekenVerbruik(nest([bak('a', 320, 300, [pl('d1', 100, 270)], 270)]), [doek('d1')], R, inst);
  assert.equal(v.perBak[0].restLengte, 30);
  assert.equal(v.perBak[0].restIsVerlies, true);
  assert.equal(v.perBak[0].brutoLengte, 300);
});

test('restlengte voorraad', () => {
  const v = berekenVerbruik(nest([bak('a', 320, 300, [pl('d1', 100, 200)], 200)]), [doek('d1')], R, inst);
  assert.equal(v.perBak[0].restLengte, 100);
  assert.equal(v.perBak[0].restIsVerlies, false);
  assert.equal(v.perBak[0].brutoLengte, 200);
});

test('m2', () => {
  const v = berekenVerbruik(nest([bak('a', 320, 200, [pl('d1', 100, 200, 1), pl('d1', 100, 200, 2)], 200)]), [doek('d1')], R, inst);
  assert.ok(Math.abs(v.perBak[0].brutoM2 - 6.4) < 1e-9);
  assert.ok(Math.abs(v.perBak[0].nettoM2 - 4) < 1e-9);
  assert.ok(Math.abs(v.perBak[0].verliesM2 - 2.4) < 1e-9);
  assert.ok(Math.abs(v.totaal.brutoM1 - 2) < 1e-9);
});

test('smal reststuk gebruikt eigen breedte', () => {
  const v = berekenVerbruik(nest([bak('a', 200, 300, [pl('d1', 100, 100)], 100)]), [doek('d1')], R, inst);
  assert.ok(Math.abs(v.perBak[0].brutoM2 - 2) < 1e-9);
});

test('verdeling', () => {
  // bak 320 x 187.5 => bruto 6 m2; netto 3 + 1 = 4 (d1 heeft twee banen)
  const b = bak('a', 320, 187.5, [pl('d1', 100, 100, 1), pl('d1', 100, 200, 2), pl('d2', 100, 100)], 187.5);
  const v = berekenVerbruik(nest([b]), [doek('d1'), doek('d2'), doek('d3')], R, inst);
  assert.equal(v.doeken.length, 2);
  const d1 = v.doeken.find((d) => d.doekId === 'd1');
  const d2 = v.doeken.find((d) => d.doekId === 'd2');
  assert.ok(Math.abs(d1.nettoM2 - 3) < 1e-9);
  assert.ok(Math.abs(d1.brutoM2 - 4.5) < 1e-9);
  assert.ok(Math.abs(d2.brutoM2 - 1.5) < 1e-9);
  assert.ok(Math.abs(d1.m1 - 4.5 / 3.2) < 1e-9);
  assert.equal(d1.orderNr, 'O-d1');
  assert.equal(d1.stof, 'R');
  const som = v.doeken.reduce((s, d) => s + d.brutoM2, 0);
  assert.ok(Math.abs(som - v.totaal.brutoM2) < 1e-9);
});

test('verliesfactor', () => {
  const v = berekenVerbruik(nest([bak('a', 320, 200, [pl('d1', 100, 200, 1), pl('d1', 100, 200, 2)], 200)]), [doek('d1')], R, inst);
  assert.ok(Math.abs(v.totaal.verliesfactor - 6.4 / 4) < 1e-9);
});

test('verliesfactor >= 1 bij willekeurige nesting', () => {
  const rnd = mulberry32(42);
  for (let ronde = 0; ronde < 20; ronde++) {
    const stukken = [];
    for (let i = 0; i < 15; i++) {
      const id = `s${ronde}-${i}`;
      stukken.push({ id, doekId: id, orderNr: 'O', product: 'P', stof: 'R', w: 20 + Math.floor(rnd() * 280), h: 20 + Math.floor(rnd() * 250), magDraaien: rnd() < 0.5, vastGedraaid: false, baan: null });
    }
    const n = nestStof(stukken, R, [], inst);
    const v = berekenVerbruik(n, stukken.map((s) => doek(s.doekId)), R, inst);
    assert.ok(v.totaal.verliesfactor >= 1 - 1e-9, `factor ${v.totaal.verliesfactor}`);
    assert.ok(Math.abs(v.doeken.reduce((s, d) => s + d.brutoM2, 0) - v.totaal.brutoM2) < 1e-9);
  }
});

test('leeg', () => {
  const v = berekenVerbruik(nest([]), [], R, inst);
  assert.deepEqual(v.totaal, { brutoM1: 0, brutoM2: 0, nettoM2: 0, verliesM2: 0, verliesfactor: 1 });
  assert.deepEqual(v.doeken, []);
  assert.deepEqual(v.perBak, []);
  assert.equal(JSON.stringify(v).includes('NaN'), false);
  const leegBak = berekenVerbruik(nest([bak('a', 320, 300, [], 0)]), [], R, inst);
  assert.equal(leegBak.perBak.length, 0);
});

test('F11: m1 per doek telt exact op tot bruto m1, ook met een smal reststuk', () => {
  const smal = bak('rs', 200, 300, [pl('d1', 100, 100)], 100);
  const breed = bak('r', 320, 3000, [pl('d2', 300, 200)], 200);
  const v = berekenVerbruik(nest([smal, breed]), [doek('d1'), doek('d2')], R, inst);
  const som = v.doeken.reduce((s, d) => s + d.m1, 0);
  assert.ok(Math.abs(som - v.totaal.brutoM1) < 1e-9, `${som} vs ${v.totaal.brutoM1}`);
  for (const d of v.doeken) assert.ok(Math.abs(d.m1 - d.aandeel * v.totaal.brutoM1) < 1e-12);
});
