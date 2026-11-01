import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseer, STANDAARD_INSTELLINGEN } from '../demo/scenario.js';
import { voorbeeldScenario } from '../engine/voorbeelddata.js';
import { analyseer } from '../engine/index.js';

test('lege en kapotte lijsten worden lege lijsten', () => {
  const sc = normaliseer({ versie: 1, stoffen: 'x', openOrders: null });
  for (const k of ['stoffen', 'producttypes', 'openOrders', 'historie', 'voorraad']) assert.deepEqual(sc[k], []);
  assert.deepEqual(sc.gevoel, {});
  assert.deepEqual(sc.instellingen, STANDAARD_INSTELLINGEN);
});

test('null, getallen en arrays in lijsten worden weggefilterd', () => {
  const sc = normaliseer({ versie: 1, openOrders: [null, 5, [], 'a', { stof: 'S5A', breedte: 100, hoogte: 100 }], stoffen: [null], voorraad: [null], producttypes: [7] });
  assert.equal(sc.openOrders.length, 1);
  assert.deepEqual(sc.stoffen, []);
  assert.deepEqual(sc.voorraad, []);
  assert.deepEqual(sc.producttypes, []);
});

test('velden krijgen het juiste type', () => {
  const sc = normaliseer({
    versie: 1,
    openOrders: [{ orderNr: 12, stof: 'S5A', product: 'screen', breedte: '200', hoogte: 'abc' }],
    stoffen: [{ code: 'S5A', rolbreedte: '250', rollengte: 30, prijsPerM1: 14, draaienToegestaan: 'ja' }],
    producttypes: [{ code: 'screen' }],
    voorraad: [{ id: 1, stof: 'S5A', soort: 'vreemd', breedte: 250, lengte: '1000' }],
    gevoel: { S5A: '12', S3W: -1, VDG: 40 },
    instellingen: { naadtoeslag: 'x', snijspeling: 1, horizonMaanden: 2 },
  });
  assert.deepEqual(sc.openOrders[0], { orderNr: '12', datum: '', product: 'screen', stof: 'S5A', breedte: 200, hoogte: null, aantal: 1 });
  assert.deepEqual(sc.stoffen[0], { code: 'S5A', naam: 'S5A', rolbreedte: 250, rollengte: 30, prijsPerM1: 14, draaien: 'vrij' });
  assert.deepEqual(sc.producttypes[0], { code: 'screen', naam: 'screen', toeslagBreedte: 0, toeslagHoogte: 0, banenToegestaan: false });
  assert.deepEqual(sc.voorraad[0], { id: '1', stof: 'S5A', soort: 'rol', breedte: 250, lengte: 1000 });
  assert.deepEqual(sc.gevoel, { VDG: 40 });
  assert.equal(sc.instellingen.naadtoeslag, 4);
  assert.equal(sc.instellingen.snijspeling, 1);
  assert.equal(sc.instellingen.horizonMaanden, 1);
});

test('voorbeeldscenario blijft gelijk na normaliseren', () => {
  const vb = voorbeeldScenario();
  assert.deepEqual(normaliseer(vb), vb);
});

test('genormaliseerd kapot scenario rekent zonder fout', () => {
  const sc = normaliseer({ versie: 1, openOrders: [null, { stof: 'S5A' }], stoffen: [null, { code: 'S5A' }], historie: [{}] });
  assert.doesNotThrow(() => analyseer(sc));
});

test('F1/F4: draairegel en banen worden genormaliseerd', () => {
  const sc = normaliseer({
    stoffen: [{ code: 'A', draaienToegestaan: false }, { code: 'B', draaien: 'alsTeBreed' }, { code: 'C', draaien: 'raar', draaienToegestaan: true }],
    producttypes: [{ code: 'knik' }, { code: 'rol', naam: 'Rolgordijn' }, { code: 'screen', banenToegestaan: true }],
  });
  assert.deepEqual(sc.stoffen.map((s) => s.draaien), ['nooit', 'alsTeBreed', 'vrij']);
  assert.ok(sc.stoffen.every((s) => !('draaienToegestaan' in s)));
  assert.deepEqual(sc.producttypes.map((p) => p.banenToegestaan), [true, false, true]);
});
