import test from 'node:test';
import assert from 'node:assert/strict';
import { zoekStof, zoekProduct } from '../engine/catalogus.js';
import { maakStukken } from '../engine/snijmaat.js';

const scenario = {
  stoffen: [
    { code: 'T', naam: 'Smal', rolbreedte: 120, rollengte: 40, prijsPerM1: 10, draaienToegestaan: false },
    { code: 'R', naam: 'Breed', rolbreedte: 320, rollengte: 30, prijsPerM1: 20, draaienToegestaan: true },
  ],
  producttypes: [
    { code: 'knik', naam: 'Knikarmscherm', toeslagBreedte: 6, toeslagHoogte: 20 },
    { code: 'screen', naam: 'Screen', toeslagBreedte: 4, toeslagHoogte: 12 },
  ],
  instellingen: { naadtoeslag: 4 },
};
const regel = (o) => ({ orderNr: 'A', datum: '2026-11-02', product: 'screen', stof: 'R', breedte: 200, hoogte: 150, aantal: 1, ...o });
const bijna = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('lookup tolerant', () => {
  assert.equal(zoekStof(scenario.stoffen, ' r ').code, 'R');
  assert.equal(zoekStof(scenario.stoffen, 'breed').code, 'R');
  assert.equal(zoekStof(scenario.stoffen, 'x'), null);
  assert.equal(zoekProduct(scenario.producttypes, 'SCREEN').code, 'screen');
  assert.equal(zoekProduct(scenario.producttypes, ' knikarmscherm ').code, 'knik');
  assert.equal(zoekProduct(scenario.producttypes, 'x'), null);
  const r = maakStukken([regel({ stof: ' r ' })], scenario);
  assert.equal(r.doeken[0].stof, 'R');
  const s = maakStukken([regel({ stof: 'x' }), regel({ product: 'x' }), regel({ breedte: 0 })], scenario);
  assert.deepEqual(s.waarschuwingen.map((w) => w.soort), ['onbekendeStof', 'onbekendProduct', 'ongeldigeMaat']);
  assert.equal(s.doeken.length, 0);
  assert.equal(s.stukken.length, 0);
});

test('toeslagen', () => {
  const r = maakStukken([regel({})], scenario);
  assert.equal(r.stukken.length, 1);
  assert.deepEqual(
    { w: r.stukken[0].w, h: r.stukken[0].h, magDraaien: r.stukken[0].magDraaien, vastGedraaid: r.stukken[0].vastGedraaid, baan: r.stukken[0].baan },
    { w: 204, h: 162, magDraaien: true, vastGedraaid: false, baan: null });
  const d = r.doeken[0];
  assert.equal(d.snijB, 204);
  assert.equal(d.snijH, 162);
  bijna(d.nettoM2, 3.3048);
  assert.equal(d.product, 'screen');
  assert.equal(r.stukken[0].id, `${d.doekId}/1`);
  assert.equal(r.stukken[0].doekId, d.doekId);
});

test('aantal en regelIndex', () => {
  const r = maakStukken([regel({ aantal: 3 })], scenario);
  assert.deepEqual(r.doeken.map((d) => d.doekId), ['0:A#1', '0:A#2', '0:A#3']);
  const r2 = maakStukken([regel({ stof: 'x' }), regel({ orderNr: 'B' })], scenario);
  assert.equal(r2.doeken[0].doekId, '1:B#1');
});

test('te breed, draaien mag', () => {
  const r = maakStukken([regel({ product: 'knik', breedte: 500, hoogte: 300 })], scenario);
  assert.equal(r.stukken.length, 1);
  const s = r.stukken[0];
  assert.deepEqual({ w: s.w, h: s.h, magDraaien: s.magDraaien, vastGedraaid: s.vastGedraaid }, { w: 320, h: 506, magDraaien: false, vastGedraaid: true });
  assert.equal(r.doeken[0].snijB, 506);
});

test('banen', () => {
  const r = maakStukken([regel({ product: 'knik', stof: 'T', breedte: 500, hoogte: 300 })], scenario);
  assert.equal(r.stukken.length, 5);
  r.stukken.forEach((s, k) => {
    bijna(s.w, 104.4);
    assert.equal(s.h, 320);
    assert.equal(s.magDraaien, false);
    assert.deepEqual(s.baan, { i: k + 1, n: 5 });
    assert.equal(s.id, `${r.doeken[0].doekId}/${k + 1}`);
  });
  bijna(r.doeken[0].nettoM2, (5 * 104.4 * 320) / 10000);
});

test('banen ook als draaien mag maar snijH te breed', () => {
  const r = maakStukken([regel({ product: 'knik', breedte: 500, hoogte: 400 })], scenario);
  assert.equal(r.stukken.length, 2);
  for (const s of r.stukken) { bijna(s.w, 255); assert.equal(s.h, 420); }
});

test('onplaatsbaar', () => {
  const r = maakStukken([regel({ breedte: 100, hoogte: 4000, aantal: 2 })], scenario);
  assert.equal(r.stukken.length, 0);
  assert.equal(r.doeken.length, 0);
  assert.equal(r.waarschuwingen.length, 1);
  assert.equal(r.waarschuwingen[0].soort, 'onplaatsbaar');
  assert.equal(r.waarschuwingen[0].orderNr, 'A');
});
