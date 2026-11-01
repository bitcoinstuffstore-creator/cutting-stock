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
    assert.ok(Math.abs(p.inkoop.uitVoorraadM1 + p.inkoop.uitNieuwM1 - p.inkoop.hardBrutoM1) < 1e-9, st.code);
    const m1 = r.doeken.filter((d) => d.stof === st.code).reduce((a, d) => a + d.m1, 0);
    assert.ok(Math.abs(m1 - p.inkoop.hardBrutoM1) < 1e-6, `${st.code} m1`);
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

// ---------- Final fix wave ----------
test('F1/F2: voorbeelddata: geen screen of rolgordijn in banen; banen van een doek op één bak', () => {
  const s = voorbeeldScenario();
  const r = analyseer(s);
  for (const p of Object.values(r.perStof)) {
    const perDoek = new Map();
    for (const b of p.snijplan.bakken) for (const pl of b.plaatsingen) {
      if (!perDoek.has(pl.doekId)) perDoek.set(pl.doekId, new Set());
      perDoek.get(pl.doekId).add(b.id);
    }
    for (const [doekId, bakken] of perDoek) assert.equal(bakken.size, 1, doekId);
  }
  const doek = new Map(r.doeken.map((d) => [d.doekId, d]));
  for (const p of Object.values(r.perStof)) for (const b of p.snijplan.bakken) {
    const n = new Map();
    for (const pl of b.plaatsingen) n.set(pl.doekId, (n.get(pl.doekId) || 0) + 1);
    for (const [id, k] of n) if (k > 1) assert.ok(['knikarm', 'uitval'].includes(doek.get(id).product), id);
  }
  assert.ok(!r.waarschuwingen.length, JSON.stringify(r.waarschuwingen));
});

test('F6: snijspeling 1 en 2 op de voorbeelddata: niets onplaatsbaar', () => {
  for (const sp of [1, 2]) {
    const s = voorbeeldScenario();
    s.instellingen.snijspeling = sp;
    const r = analyseer(s);
    assert.equal(r.waarschuwingen.filter((w) => w.soort === 'onplaatsbaar').length, 0, `speling ${sp}`);
    for (const p of Object.values(r.perStof)) assert.equal(p.snijplan.onplaatsbaar.length, 0);
  }
});

test('F7: ongeldige stof wordt overgeslagen met een melding, totalen blijven eindig', () => {
  for (const kapot of [null, 0, NaN, Infinity, undefined]) {
    const s = voorbeeldScenario();
    s.stoffen[0].rolbreedte = kapot;
    s.stoffen[1].rollengte = kapot;
    const r = analyseer(s);
    assert.ok(!('S5A' in r.perStof) && !('S3W' in r.perStof));
    for (const v of Object.values(r.totalen)) assert.ok(Number.isFinite(v), `${kapot}: ${JSON.stringify(r.totalen)}`);
    const w = r.waarschuwingen.filter((x) => x.soort === 'ongeldigeStof');
    assert.ok(w.length >= 2);
    assert.ok(w.some((x) => /Screen 5% Antraciet/.test(x.melding)));
  }
  // Ook zonder orders op die stof één melding.
  const s = voorbeeldScenario();
  s.stoffen.push({ code: 'LEEG', naam: 'Lege stof', rolbreedte: null, rollengte: 30, prijsPerM1: 5, draaien: 'nooit' });
  const w = analyseer(s).waarschuwingen.filter((x) => x.soort === 'ongeldigeStof');
  assert.equal(w.length, 1);
  assert.match(w[0].melding, /Lege stof/);
});

test('F8: dubbele stofcode telt één keer; dubbele voorraad-ids botsen niet', () => {
  const s = voorbeeldScenario();
  const basis = analyseer(s);
  s.stoffen.push({ ...s.stoffen[0], naam: 'Dubbel' }, { ...s.stoffen[1], code: 's3w' });
  const r = analyseer(s);
  assert.deepEqual(Object.keys(r.perStof).sort(), Object.keys(basis.perStof).sort());
  assert.ok(Math.abs(r.totalen.kosten - basis.totalen.kosten) < 1e-9);
  assert.equal(r.waarschuwingen.filter((w) => w.soort === 'dubbeleStof').length, 2);
  assert.equal(r.normen.length, basis.normen.length);

  const v = voorbeeldScenario();
  v.voorraad.push({ id: 'R-S5A-1', stof: 'S5A', soort: 'reststuk', breedte: 250, lengte: 400 });
  const rv = analyseer(v);
  const ids = rv.perStof.S5A.snijplan.bakken.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(','));
  assert.ok(rv.perStof.S5A.snijplan.bakken.filter((b) => b.voorraadId === 'R-S5A-1').length === 2);
});

test('F16: elke waarschuwing van een orderregel heeft een regelIndex', () => {
  const s = voorbeeldScenario();
  s.openOrders.push({ orderNr: s.openOrders[0].orderNr, datum: '2026-11-05', product: 'screen', stof: 'XXX', breedte: 100, hoogte: 100, aantal: 1 });
  s.historie.splice(3, 0, { orderNr: 'H-X', datum: 'gisteren', product: 'screen', stof: 'S5A', breedte: 100, hoogte: 100, aantal: 1 });
  s.historie.splice(10, 0, { orderNr: 'H-Y', datum: '2026-01-02', product: 'screen', stof: 'YYY', breedte: 100, hoogte: 100, aantal: 1 });
  const r = analyseer(s);
  const open = r.waarschuwingen.find((w) => w.bron === 'open');
  assert.equal(open.regelIndex, 60);
  assert.equal(r.waarschuwingen.find((w) => w.soort === 'ongeldigeDatum').regelIndex, 3);
  assert.equal(r.waarschuwingen.find((w) => w.bron === 'historie' && w.soort === 'onbekendeStof').regelIndex, 10);
});
