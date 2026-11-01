import test from 'node:test';
import assert from 'node:assert/strict';
import { doekRijen, inkoopCSV, doekenCSV, verschilSoort } from '../demo/resultaat-rijen.js';
import { analyseer } from '../engine/index.js';
import { voorbeeldScenario } from '../engine/voorbeelddata.js';

const scenario = {
  producttypes: [{ code: 'screen', naam: 'Screen', toeslagBreedte: 4, toeslagHoogte: 12 }],
  openOrders: [
    { orderNr: 'A-1', product: 'screen', stof: 'S1', breedte: 200, hoogte: 150, aantal: 2 },
    { orderNr: 'B;2', product: 'Screen', stof: 'S1', breedte: 100.5, hoogte: 80, aantal: 1 },
  ],
};
const resultaat = {
  doeken: [
    { doekId: '0:A-1#1', orderNr: 'A-1', product: 'screen', stof: 'S1', nettoM2: 3.2448, aandeel: 0.4, brutoM2: 3.912345, m1: 1.56789 },
    { doekId: '1:B;2#1', orderNr: 'B;2', product: 'screen', stof: 'S1', nettoM2: 0.9, aandeel: 0.2, brutoM2: 1.1, m1: 0.44 },
  ],
  perStof: {
    S1: {
      stof: { code: 'S1', naam: 'Stof "een"', prijsPerM1: 10 },
      inkoop: { hardBrutoM1: 12.345, uitVoorraadM1: 10.3, uitNieuwM1: 2.045, nieuweRollenHard: 1, verwachtM1: 3, restVoorraadM1: 1.5, teBestellenRollen: 1, teBestellenM1: 30, kosten: 300, gevoelM1: 11, gevoelBron: 'toeslag', verschilM1: -1.346, verschilEuro: -13.45 },
    },
  },
};

test('doekRijen: ordermaat uit de orderregel, snijmaat = ordermaat + toeslag', () => {
  const rijen = doekRijen(resultaat, scenario);
  assert.equal(rijen.length, 2);
  assert.deepEqual(rijen[0].ordermaat, { b: 200, h: 150 });
  assert.deepEqual(rijen[0].snijmaat, { b: 204, h: 162 });
  assert.equal(rijen[0].productNaam, 'Screen');
  assert.deepEqual(rijen[1].snijmaat, { b: 104.5, h: 92 });
});

test('doekRijen: onbekende regel of product geeft geen maat in plaats van een fout', () => {
  const rijen = doekRijen({ ...resultaat, doeken: [{ ...resultaat.doeken[0], doekId: '9:X#1', orderNr: 'X' }] }, scenario);
  assert.equal(rijen[0].ordermaat, null);
  assert.equal(rijen[0].snijmaat, null);
});

test('inkoopCSV: kop, puntkomma, komma als decimaalteken, afgerond op 2', () => {
  const csv = inkoopCSV(resultaat).split('\n');
  assert.equal(csv.length, 2);
  assert.match(csv[0], /^Stofcode;Stof;Harde behoefte m1;Uit voorraad m1;Rollen voor open orders;Verwacht m1;/);
  assert.ok(csv[1].startsWith('S1;"Stof ""een""";12,35;10,3;1;3;1,5;1;30;300;11;toeslag;-1,35;-13,45;te weinig'), csv[1]);
});

test('doekenCSV: maten als getallen, velden met ; tussen aanhalingstekens', () => {
  const csv = doekenCSV(doekRijen(resultaat, scenario)).split('\n');
  assert.match(csv[0], /^Order;Product;Stof;Breedte cm;Hoogte cm;Snijbreedte cm;Snijhoogte cm;Netto m2;Bruto m2;m1$/);
  assert.equal(csv[1], 'A-1;Screen;S1;200;150;204;162;3,24;3,91;1,57');
  assert.ok(csv[2].startsWith('"B;2";'));
});

test('verschilSoort werkt voor beide tekens', () => {
  assert.equal(verschilSoort(-120).soort, 'te-weinig');
  assert.equal(verschilSoort(-120).tekst, 'te weinig');
  assert.equal(verschilSoort(8.4).tekst, 'te veel');
  assert.equal(verschilSoort(0.001).soort, 'gelijk');
});

test('voorbeelddata: elke doek heeft een ordermaat en snijmaat', () => {
  const sc = voorbeeldScenario();
  const rijen = doekRijen(analyseer(sc), sc);
  assert.ok(rijen.length > 50);
  assert.ok(rijen.every((r) => r.ordermaat && r.snijmaat && r.snijmaat.b > r.ordermaat.b));
});

// ---------- F12/F13 en F7: één drempel, splitsing per richting, geen richting bij ongeldige getallen ----------
import { verschilKop } from '../demo/resultaat-rijen.js';

test('F12: gelijk onder 50 cent, zowel in de tabel als in de kop', () => {
  assert.equal(verschilSoort(0.49).soort, 'gelijk');
  assert.equal(verschilSoort(-0.49).soort, 'gelijk');
  assert.equal(verschilSoort(0.5).soort, 'te-veel');
  const k = verschilKop({ verschilEuro: 0.3, verschilPct: 0.01, berekendEuro: 3000 }, {});
  assert.equal(k.soort, 'gelijk');
});

test('F13: splitsing te veel / te weinig per stof', () => {
  const ps = (e) => ({ inkoop: { verschilEuro: e } });
  const k = verschilKop({ verschilEuro: -60, verschilPct: -2, berekendEuro: 3000 }, { A: ps(30), B: ps(-50), C: ps(-40), D: ps(0.2) });
  assert.equal(k.soort, 'te-weinig');
  assert.deepEqual(k.split, { teVeel: { euro: 30, n: 1 }, teWeinig: { euro: 90, n: 2 } });
  const een = verschilKop({ verschilEuro: -90, verschilPct: -3, berekendEuro: 3000 }, { B: ps(-50), C: ps(-40) });
  assert.equal(een.split, null);
});

test('F7: geen richting bij ongeldige getallen of zonder berekende stof', () => {
  assert.equal(verschilKop({ verschilEuro: NaN, verschilPct: NaN, berekendEuro: NaN }, {}), null);
  assert.equal(verschilKop({ verschilEuro: 0, verschilPct: 0, berekendEuro: 0 }, {}), null);
});
