import test from 'node:test';
import assert from 'node:assert/strict';
import { maatklasse, berekenNormen } from '../engine/normen.js';

const bijna = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const base = (historie, historieMaanden = 3) => ({
  stoffen: [
    { code: 'R', naam: 'Breed', rolbreedte: 320, rollengte: 30, prijsPerM1: 20, draaienToegestaan: true },
    { code: 'T', naam: 'Smal', rolbreedte: 120, rollengte: 40, prijsPerM1: 10, draaienToegestaan: false },
  ],
  producttypes: [{ code: 'screen', naam: 'Screen', toeslagBreedte: 0, toeslagHoogte: 0 }],
  instellingen: { naadtoeslag: 0, snijspeling: 0, minReststukLengte: 0, historieMaanden },
  historie,
});
const regel = (o) => ({ orderNr: 'A', datum: '2026-01-10', product: 'screen', stof: 'R', breedte: 100, hoogte: 100, aantal: 1, ...o });

test('maatklasse', () => {
  assert.equal(maatklasse(149), '<150');
  assert.equal(maatklasse(150), '150-249');
  assert.equal(maatklasse(249), '150-249');
  assert.equal(maatklasse(250), '250-349');
  assert.equal(maatklasse(349), '250-349');
  assert.equal(maatklasse(350), '>=350');
});

test('maandgroepering', () => {
  const r = berekenNormen(base([regel({ datum: '2026-01-05' }), regel({ datum: '2026-03-05', orderNr: 'B' })]));
  assert.deepEqual(r.maandverbruik.R.map((m) => m.maand), ['2026-01', '2026-02', '2026-03']);
  assert.equal(r.maandverbruik.R[1].brutoM1, 0);
  assert.ok(r.maandverbruik.R[0].brutoM1 > 0);
  assert.deepEqual(r.maandverbruik.T.map((m) => m.brutoM1), [0, 0, 0]);
});

// Een stuk van 320 x h cm op een rol van 320 breed: bruto m1 = h/100.
const maand = (datum, hoogte) => regel({ datum, orderNr: datum, breedte: 320, hoogte });
const hist = [maand('2026-01-05', 300), maand('2026-03-05', 600)];

test('venster', () => {
  const m = (n) => berekenNormen(base(hist, n)).verwachtPerMaand.R;
  bijna(m(3), 3); // (3+0+6)/3
  bijna(m(2), 3);
  bijna(m(1), 6);
  bijna(m(5), 3); // geklemd op 3 beschikbare maanden
});

test('norm', () => {
  const h = [1, 2, 3, 4].map((i) => regel({ orderNr: 'N' + i, breedte: 100, hoogte: 100 }));
  const r = berekenNormen(base(h));
  assert.equal(r.normen.length, 1);
  const n = r.normen[0];
  assert.equal(n.aantalDoeken, 4);
  assert.equal(n.stof, 'R');
  assert.equal(n.maatklasse, '<150');
  bijna(n.gemNettoM2, 1);
  const bruto = r.maandverbruik.R[0].brutoM1; // m1 totaal
  bijna(n.gemM1 * 4, 4 * 1 * n.verliesfactor / (320 / 100));
  assert.ok(n.verliesfactor >= 1);
  assert.ok(bruto > 0);
});

test('sortering', () => {
  const h = [regel({ breedte: 400, orderNr: 'a' }), regel({ breedte: 100, orderNr: 'b', stof: 'T' }), regel({ breedte: 100, orderNr: 'c' })];
  const r = berekenNormen(base(h));
  assert.deepEqual(r.normen.map((n) => `${n.stof}/${n.maatklasse}`), ['R/<150', 'R/>=350', 'T/<150']);
});

test('leeg', () => {
  const r = berekenNormen(base([]));
  assert.deepEqual(r.normen, []);
  assert.deepEqual(r.maandverbruik, { R: [], T: [] });
  assert.deepEqual(r.verwachtPerMaand, { R: 0, T: 0 });
  assert.deepEqual(r.waarschuwingen, []);
});

test('waarschuwingen doorgegeven', () => {
  const r = berekenNormen(base([regel({ stof: 'Z' })]));
  assert.equal(r.waarschuwingen[0].soort, 'onbekendeStof');
});
