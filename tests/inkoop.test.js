import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berekenInkoop } from '../engine/inkoop.js';

const R = { code: 'R', rolbreedte: 320, rollengte: 30, prijsPerM1: 17 };
const inst = (h = 0) => ({ minReststukLengte: 50, gevoelToeslag: 15, horizonMaanden: h });
const bak = (id, soort, lengte, gebruikteLengte, breedte = 320) => ({ id, soort, voorraadId: soort === 'nieuw' ? null : id, breedte, lengte, plaatsingen: [], gebruikteLengte });
const nest = (bakken, nieuweRollen = 0) => ({ bakken, strategie: 'x', nieuweRollen, onplaatsbaar: [] });
const verb = (brutoM1, nettoM2) => ({ perBak: [], doeken: [], totaal: { brutoM1, brutoM2: brutoM1 * 3.2, nettoM2, verliesM2: 0, verliesfactor: 0 } });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const basis = () => ({ stof: R, nest: nest([bak('r1', 'rol', 3000, 1200)]), verbruik: verb(12, 30), verwachtPerMaand: 25, gevoelM1: undefined, instellingen: inst(0) });

test('voorraad dekt alles', () => {
  const r = berekenInkoop(basis());
  assert.equal(r.stof, 'R');
  assert.equal(r.hardBrutoM1, 12);
  assert.equal(r.nieuweRollenHard, 0);
  assert.equal(r.restVoorraadM1, 18);
  assert.equal(r.verwachtM1, 0);
  assert.equal(r.extraM1, 0);
  assert.equal(r.teBestellenRollen, 0);
  assert.equal(r.kosten, 0);
});

test('horizon', () => {
  const r = berekenInkoop({ ...basis(), instellingen: inst(1) });
  assert.equal(r.verwachtM1, 25);
  assert.equal(r.extraM1, 7);
  assert.equal(r.teBestellenRollen, 1);
  assert.equal(r.teBestellenM1, 30);
  assert.equal(r.kosten, 510);
});

test('nieuwe rollen', () => {
  const r = berekenInkoop({ ...basis(), nest: nest([bak('nieuw-1', 'nieuw', 3000, 2000)], 1) });
  assert.equal(r.nieuweRollenHard, 1);
  assert.equal(r.restVoorraadM1, 10);
  assert.equal(r.teBestellenRollen, 1);
});

test('kleine rest telt niet', () => {
  const r = berekenInkoop({ ...basis(), nest: nest([bak('r1', 'rol', 3000, 2960)]) });
  assert.equal(r.restVoorraadM1, 0);
});

test('reststukken tellen niet voor prognose', () => {
  const r = berekenInkoop({ ...basis(), nest: nest([bak('r1', 'rol', 3000, 1200), bak('s1', 'reststuk', 400, 0)]) });
  assert.equal(r.restVoorraadM1, 18);
});

test('gevoel toeslag', () => {
  const r = berekenInkoop(basis());
  assert.equal(r.gevoelBron, 'toeslag');
  near(r.gevoelM1, 10.78125);
  near(r.verschilM1, 10.78125 - 12);
  near(r.verschilEuro, (10.78125 - 12) * 17);
});

test('gevoel eigen', () => {
  const r = berekenInkoop({ ...basis(), gevoelM1: 20 });
  assert.equal(r.gevoelBron, 'eigen');
  assert.equal(r.gevoelM1, 20);
  assert.equal(r.verschilM1, 8);
  assert.equal(r.verschilEuro, 136);
});

test('geen orders', () => {
  const r = berekenInkoop({ stof: R, nest: nest([]), verbruik: verb(0, 0), verwachtPerMaand: 0, gevoelM1: undefined, instellingen: inst(3) });
  for (const [k, v] of Object.entries(r)) if (k !== 'stof' && k !== 'gevoelBron') assert.ok(Number.isFinite(v), k);
  assert.equal(r.hardBrutoM1, 0);
  assert.equal(r.nieuweRollenHard, 0);
  assert.equal(r.gevoelM1, 0);
  assert.equal(r.teBestellenRollen, 0);
});
