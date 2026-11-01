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
  // 4 stukken van 100x100 op rol 320: 2 rijen = 200 cm -> bruto 6,4 m2, per doek 1,6 m2 = 0,5 m1
  bijna(n.gemM1, 0.5);
  bijna(n.verliesfactor, 1.6);
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

test('ongeldige datum wordt overgeslagen', () => {
  for (const datum of ['2026-1-5', '05-01-2026', '', '2026-13-01']) {
    const r = berekenNormen(base([regel({ datum, aantal: 2 }), regel({ orderNr: 'OK' })]));
    const w = r.waarschuwingen.filter((x) => x.soort === 'ongeldigeDatum');
    assert.equal(w.length, 1, datum);
    assert.equal(w[0].orderNr, 'A');
    assert.deepEqual(r.maandverbruik.R.map((m) => m.maand), ['2026-01']);
    assert.equal(r.normen.reduce((a, n) => a + n.aantalDoeken, 0), 1);
  }
  const r = berekenNormen(base([regel({ datum: 'kapot' })]));
  assert.deepEqual(r.normen, []);
  assert.deepEqual(r.maandverbruik.R, []);
});

test('jaarwisseling', () => {
  const r = berekenNormen(base([regel({ datum: '2025-12-20' }), regel({ datum: '2026-01-03', orderNr: 'B' })]));
  assert.deepEqual(r.maandverbruik.R.map((m) => m.maand), ['2025-12', '2026-01']);
});

test('verliesfactor over hele historie', () => {
  // maand 1: 100x100 (bruto 3,2 / netto 1); maand 2: 320x100 (bruto 3,2 / netto 3,2)
  const r = berekenNormen(base([regel({ datum: '2026-01-05' }), regel({ datum: '2026-02-05', orderNr: 'B', breedte: 320 })]));
  assert.equal(r.normen.length, 2);
  for (const n of r.normen) bijna(n.verliesfactor, 6.4 / 4.2);
});
