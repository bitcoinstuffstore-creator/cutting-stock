import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { analyseer, parseOrdersCSV, maatklasse, STRATEGIEEN } from '../engine/index.js';
import { voorbeeldScenario } from '../engine/voorbeelddata.js';

test('re-exports', () => {
  assert.equal(typeof parseOrdersCSV, 'function');
  assert.equal(typeof maatklasse, 'function');
  assert.ok(Array.isArray(STRATEGIEEN));
});

test('voorbeeld ijkpunt', () => {
  const s = voorbeeldScenario();
  const r = analyseer(s);
  assert.ok(Math.abs(r.totalen.verschilPct) >= 3, `verschilPct ${r.totalen.verschilPct}`);
  assert.ok(r.totalen.verliesfactor >= 1.08, `verliesfactor ${r.totalen.verliesfactor}`);
  assert.ok(new Set(s.openOrders.map((o) => o.breedte)).size >= 40, 'te weinig verschillende breedtes');
  assert.equal(r.totalen.verschilEuro, r.totalen.gevoelEuro - r.totalen.berekendEuro);
  assert.ok(r.totalen.verliesfactor >= 1);
});

test('consistent', () => {
  const s = voorbeeldScenario();
  const r = analyseer(s);
  assert.deepEqual(Object.keys(r.perStof).sort(), s.stoffen.map((x) => x.code).sort());
  for (const st of s.stoffen) {
    const p = r.perStof[st.code];
    assert.equal(p.inkoop.teBestellenM1, p.inkoop.teBestellenRollen * st.rollengte);
    const som = r.doeken.filter((d) => d.stof === st.code).reduce((a, d) => a + d.brutoM2, 0);
    assert.ok(Math.abs(som - p.verbruik.totaal.brutoM2) < 1e-6, `${st.code}: ${som} vs ${p.verbruik.totaal.brutoM2}`);
  }
  const kosten = Object.values(r.perStof).reduce((a, p) => a + p.inkoop.kosten, 0);
  assert.ok(Math.abs(kosten - r.totalen.kosten) < 1e-6);
});

test('leeg scenario', () => {
  const r = analyseer({ ...voorbeeldScenario(), openOrders: [], historie: [] });
  assert.ok(!JSON.stringify(r).includes('NaN'));
  assert.equal(r.totalen.kosten, 0);
  assert.equal(r.totalen.verliesfactor, 1);
  assert.equal(r.totalen.verschilPct, 0);
});

test('waarschuwingen doorgegeven', () => {
  const s = voorbeeldScenario();
  s.openOrders.push({ orderNr: 'X1', datum: '2026-11-05', product: 'screen', stof: 'XXX', breedte: 100, hoogte: 100, aantal: 1 });
  const w = analyseer(s).waarschuwingen.filter((x) => x.soort === 'onbekendeStof');
  assert.equal(w.length, 1);
  assert.equal(w[0].bron, 'open');
});

test('scenario niet gemuteerd', () => {
  const s = voorbeeldScenario();
  analyseer(s);
  assert.deepEqual(s, voorbeeldScenario());
});

test('snelheid', () => {
  const s = voorbeeldScenario();
  const t0 = performance.now();
  analyseer(s);
  const ms = performance.now() - t0;
  assert.ok(ms < 2000, `${ms} ms`);
});
