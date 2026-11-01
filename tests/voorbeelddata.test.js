import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voorbeeldScenario } from '../engine/voorbeelddata.js';

test('deterministisch en vers object', () => {
  const a = voorbeeldScenario();
  const b = voorbeeldScenario();
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  a.openOrders.pop();
  assert.equal(voorbeeldScenario().openOrders.length, 60);
});

test('stoffen, producttypes, instellingen', () => {
  const s = voorbeeldScenario();
  assert.equal(s.versie, 1);
  assert.deepEqual(s.stoffen.map((x) => x.code), ['S5A', 'S3W', 'VDG', 'RLZ', 'ZSB']);
  assert.deepEqual(s.producttypes.map((x) => x.code), ['screen', 'rolgordijn', 'knikarm', 'uitval']);
  assert.deepEqual(s.instellingen, { naadtoeslag: 4, snijspeling: 0, minReststukLengte: 50, gevoelToeslag: 15, historieMaanden: 3, horizonMaanden: 1 });
  assert.deepEqual(s.gevoel, {});
});

test('open orders en historie', () => {
  const s = voorbeeldScenario();
  assert.equal(s.openOrders.length, 60);
  for (const r of s.openOrders) assert.ok(r.datum >= '2026-11-02' && r.datum <= '2026-11-13', r.datum);
  const perMaand = {};
  for (const r of s.historie) perMaand[r.datum.slice(0, 7)] = (perMaand[r.datum.slice(0, 7)] || 0) + 1;
  const maanden = Object.keys(perMaand).sort();
  assert.equal(maanden.length, 12);
  assert.equal(maanden[0], '2025-11');
  assert.equal(maanden[11], '2026-10');
  for (const m of maanden) assert.ok(perMaand[m] >= 30 && perMaand[m] <= 90, `${m}: ${perMaand[m]}`);
  const piek = Math.min(...['2026-03', '2026-04', '2026-05', '2026-06'].map((m) => perMaand[m]));
  const winter = Math.max(...['2025-11', '2025-12', '2026-01'].map((m) => perMaand[m]));
  assert.ok(piek > winter);
});

test('knikarm op ZSB breder dan 480 en geen onbekende codes', () => {
  const s = voorbeeldScenario();
  assert.ok(s.openOrders.some((r) => r.product === 'knikarm' && r.stof === 'ZSB' && r.breedte > 480));
  const stoffen = new Set(s.stoffen.map((x) => x.code));
  const producten = new Set(s.producttypes.map((x) => x.code));
  for (const r of [...s.openOrders, ...s.historie]) {
    assert.ok(stoffen.has(r.stof) && producten.has(r.product), r.orderNr);
    assert.ok(r.aantal >= 1 && r.breedte > 0 && r.hoogte > 0);
  }
});

test('voorraad', () => {
  const s = voorbeeldScenario();
  const codes = new Set(s.stoffen.map((x) => x.code));
  const ids = new Set(s.voorraad.map((v) => v.id));
  assert.equal(ids.size, s.voorraad.length);
  const rest = s.voorraad.filter((v) => v.soort === 'reststuk');
  assert.ok(rest.length >= 4 && rest.length <= 6);
  for (const c of codes) {
    const n = s.voorraad.filter((v) => v.stof === c && v.soort === 'rol').length;
    assert.ok(n >= 0 && n <= 2);
  }
  assert.ok(s.voorraad.some((v) => v.soort === 'rol' && v.lengte < s.stoffen.find((x) => x.code === v.stof).rollengte * 100));
  for (const v of s.voorraad) {
    assert.ok(codes.has(v.stof));
    const st = s.stoffen.find((x) => x.code === v.stof);
    assert.ok(v.breedte <= st.rolbreedte && v.lengte <= st.rollengte * 100);
  }
});
