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

// ---------- Final fix wave: F1 banenToegestaan, F4 draaien, F6 snijspeling, F14 getallen, F16 regelIndex ----------
const sc2 = (stofExtra = {}, inst = {}) => ({
  stoffen: [
    { code: 'S', naam: 'Screen Smal', rolbreedte: 250, rollengte: 30, prijsPerM1: 10, draaien: 'alsTeBreed', ...stofExtra },
    { code: 'T', naam: 'Streep', rolbreedte: 120, rollengte: 40, prijsPerM1: 10, draaien: 'nooit' },
  ],
  producttypes: [
    { code: 'screen', naam: 'Screen', toeslagBreedte: 4, toeslagHoogte: 12, banenToegestaan: false },
    { code: 'knik', naam: 'Knikarmscherm', toeslagBreedte: 6, toeslagHoogte: 20, banenToegestaan: true },
  ],
  instellingen: { naadtoeslag: 4, ...inst },
});

test('F1: te brede screen zonder banen is onplaatsbaar met duidelijke melding', () => {
  const r = maakStukken([regel({ stof: 'S', breedte: 300, hoogte: 260 })], sc2());
  assert.equal(r.stukken.length, 0);
  assert.equal(r.waarschuwingen.length, 1);
  assert.equal(r.waarschuwingen[0].soort, 'onplaatsbaar');
  assert.equal(r.waarschuwingen[0].melding, 'Order A: doek van 304 cm is te breed voor Screen Smal (rol 250 cm); kies een bredere stof.');
});

test('F1: banen alleen als het producttype dat toestaat', () => {
  const r = maakStukken([regel({ product: 'knik', stof: 'T', breedte: 300, hoogte: 200 })], sc2());
  assert.equal(r.stukken.length, 3);
  assert.ok(r.stukken.every((s) => s.baan && s.baan.n === 3));
});

test('F1/F4: alsTeBreed draait een te brede screen vast als de hoogte past', () => {
  const r = maakStukken([regel({ stof: 'S', breedte: 300, hoogte: 200 })], sc2());
  assert.equal(r.stukken.length, 1);
  const s = r.stukken[0];
  assert.deepEqual({ w: s.w, h: s.h, magDraaien: s.magDraaien, vastGedraaid: s.vastGedraaid }, { w: 212, h: 304, magDraaien: false, vastGedraaid: true });
});

test('F4: alsTeBreed draait niet vrij als het doek past', () => {
  const r = maakStukken([regel({ stof: 'S', breedte: 200, hoogte: 150 })], sc2());
  assert.equal(r.stukken[0].magDraaien, false);
  assert.equal(r.stukken[0].vastGedraaid, false);
});

test('F4: draaien vrij en nooit; legacy boolean wordt nog begrepen', () => {
  const vrij = maakStukken([regel({ stof: 'S', breedte: 200, hoogte: 150 })], sc2({ draaien: 'vrij' }));
  assert.equal(vrij.stukken[0].magDraaien, true);
  const nooit = maakStukken([regel({ stof: 'S', breedte: 300, hoogte: 200 })], sc2({ draaien: 'nooit' }));
  assert.equal(nooit.stukken.length, 0);
  assert.equal(nooit.waarschuwingen[0].soort, 'onplaatsbaar');
  const legacy = maakStukken([regel({ stof: 'S', breedte: 200, hoogte: 150 })], sc2({ draaien: undefined, draaienToegestaan: true }));
  assert.equal(legacy.stukken[0].magDraaien, true);
  const legacyNee = maakStukken([regel({ stof: 'S', breedte: 200, hoogte: 150 })], sc2({ draaien: undefined, draaienToegestaan: false }));
  assert.equal(legacyNee.stukken[0].magDraaien, false);
});

test('F6: snijspeling telt mee in de keuze passen / draaien / banen', () => {
  // 246 + 4 = 250 past precies zonder speling, met 1 cm speling niet meer: dan vast gedraaid.
  const zonder = maakStukken([regel({ stof: 'S', breedte: 246, hoogte: 150 })], sc2());
  assert.equal(zonder.stukken[0].vastGedraaid, false);
  const met = maakStukken([regel({ stof: 'S', breedte: 246, hoogte: 150 })], sc2({}, { snijspeling: 1 }));
  assert.equal(met.stukken[0].vastGedraaid, true);
  // Banen: 120 breed, speling 2 → elke baan + speling moet in 120 passen.
  const b = maakStukken([regel({ product: 'knik', stof: 'T', breedte: 222, hoogte: 200 })], sc2({}, { snijspeling: 2 }));
  assert.ok(b.stukken.every((s) => s.w + 2 <= 120 + 1e-9), JSON.stringify(b.stukken.map((s) => s.w)));
});

test('F6: banen van één doek moeten samen op één rol passen', () => {
  // 3 banen van 1420 cm = 4260 cm > rol 4000 cm.
  const r = maakStukken([regel({ product: 'knik', stof: 'T', breedte: 300, hoogte: 1400 })], sc2());
  assert.equal(r.stukken.length, 0);
  assert.equal(r.waarschuwingen[0].soort, 'onplaatsbaar');
});

test('F14/F16: meldingen met nl-getallen en regelIndex', () => {
  const r = maakStukken([regel({ stof: 'S' }), regel({ stof: 'S', breedte: 300.25, hoogte: 260, orderNr: 'B' })], sc2());
  const w = r.waarschuwingen[0];
  assert.equal(w.regelIndex, 1);
  assert.match(w.melding, /doek van 304,3 cm/);
  const x = maakStukken([regel({ stof: 'x' })], sc2());
  assert.equal(x.waarschuwingen[0].regelIndex, 0);
});
