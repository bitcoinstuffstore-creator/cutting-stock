import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGetal, parseOrdersCSV } from '../engine/csv.js';

const VANDAAG = '2026-11-01';
const KOP = 'ordernr;datum;product;stof;breedte;hoogte;aantal';
const RIJ = 'A1;2026-11-02;screen;S5A;250;180;2';
const VERWACHT = { orderNr: 'A1', datum: '2026-11-02', product: 'screen', stof: 'S5A', breedte: 250, hoogte: 180, aantal: 2 };

test('separator ;', () => {
  const r = parseOrdersCSV(`${KOP}\n${RIJ}`, VANDAAG);
  assert.deepEqual(r.regels, [VERWACHT]);
  assert.deepEqual(r.fouten, []);
});

test('separator , en tab geven identieke rijen', () => {
  const basis = parseOrdersCSV(`${KOP}\n${RIJ}`, VANDAAG);
  for (const sep of [',', '\t']) {
    const tekst = `${KOP}\n${RIJ}`.replaceAll(';', sep);
    assert.deepEqual(parseOrdersCSV(tekst, VANDAAG), basis);
  }
});

test('aliases', () => {
  const r = parseOrdersCSV('Order,Date,Type,Artikel,B,H,Qty\nA1,2026-11-02,screen,S5A,250,180,2', VANDAAG);
  assert.deepEqual(r.regels, [VERWACHT]);
});

test('defaults voor aantal en datum', () => {
  const r = parseOrdersCSV('ordernr;product;stof;breedte;hoogte\nA1;screen;S5A;250;180', VANDAAG);
  assert.equal(r.regels.length, 1);
  assert.equal(r.regels[0].aantal, 1);
  assert.equal(r.regels[0].datum, VANDAAG);
});

test('getallen', () => {
  assert.equal(parseGetal('250,5'), 250.5);
  assert.equal(parseGetal('1.250'), 1250);
  assert.equal(parseGetal('1.250,5'), 1250.5);
  assert.equal(parseGetal('250.5'), 250.5);
  assert.ok(Number.isNaN(parseGetal('abc')));
});

test('quoted field', () => {
  const r = parseOrdersCSV(`${KOP}\nA1;2026-11-02;"Screen; extra";S5A;250;180;2`, VANDAAG);
  assert.equal(r.regels[0].product, 'Screen; extra');
});

test('foute regels worden gemeld, goede blijven', () => {
  const tekst = [KOP, RIJ, 'A2;2026-11-02;screen;S5A;abc;180;1', 'A3;2026-11-02;screen;S5A;0;180;1', 'A4;2026-11-02;screen;;250;180;1', RIJ].join('\n');
  const r = parseOrdersCSV(tekst, VANDAAG);
  assert.equal(r.regels.length, 2);
  assert.deepEqual(r.fouten.map(f => f.regelNr), [3, 4, 5]);
  for (const f of r.fouten) assert.ok(typeof f.melding === 'string' && f.melding.length > 0);
});

test('ontbrekende verplichte kolom', () => {
  const r = parseOrdersCSV('ordernr;stof;breedte\nA1;S5A;250', VANDAAG);
  assert.equal(r.regels.length, 0);
  assert.ok(r.fouten.length >= 1);
  assert.ok(r.fouten.some(f => /hoogte/.test(f.melding)));
});

test('lege invoer', () => {
  assert.deepEqual(parseOrdersCSV('', VANDAAG), { regels: [], fouten: [] });
  assert.deepEqual(parseOrdersCSV('  \n\n', VANDAAG), { regels: [], fouten: [] });
});

test('lege regels worden overgeslagen maar regelnummering blijft kloppen', () => {
  const r = parseOrdersCSV(`${KOP}\n\n${RIJ}\n\nA2;2026-11-02;screen;S5A;x;180;1`, VANDAAG);
  assert.equal(r.regels.length, 1);
  assert.equal(r.fouten[0].regelNr, 5);
});
