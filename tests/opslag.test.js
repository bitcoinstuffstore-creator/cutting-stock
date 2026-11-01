import test from 'node:test';
import assert from 'node:assert/strict';
import { SLEUTEL, laadScenario, bewaarScenario } from '../demo/opslag.js';

function nepOpslag(start = {}) {
  const data = { ...start };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}
const FALLBACK = { versie: 1, stoffen: [], bron: 'fallback' };
const fallback = () => structuredClone(FALLBACK);

test('sleutel is vast', () => {
  assert.equal(SLEUTEL, 'rollnest-scenario-v1');
});

test('ontbrekende waarde geeft fallback', () => {
  assert.deepEqual(laadScenario(nepOpslag(), fallback), FALLBACK);
});

test('ongeldige JSON geeft fallback', () => {
  assert.deepEqual(laadScenario(nepOpslag({ [SLEUTEL]: '{bad' }), fallback), FALLBACK);
});

test('andere versie geeft fallback', () => {
  assert.deepEqual(laadScenario(nepOpslag({ [SLEUTEL]: '{"versie":2}' }), fallback), FALLBACK);
});

test('getItem dat gooit geeft fallback', () => {
  const opslag = { getItem() { throw new Error('geblokkeerd'); }, setItem() {} };
  assert.deepEqual(laadScenario(opslag, fallback), FALLBACK);
});

test('bewaren en laden geeft hetzelfde scenario', () => {
  const opslag = nepOpslag();
  const sc = { versie: 1, stoffen: [{ code: 'S5A', rolbreedte: 250 }], gevoel: { S5A: 12.5 }, openOrders: [] };
  assert.equal(bewaarScenario(opslag, sc), true);
  assert.deepEqual(laadScenario(opslag, fallback), sc);
});

test('setItem dat gooit: bewaarScenario geeft false', () => {
  const opslag = { getItem: () => null, setItem() { throw new Error('vol'); } };
  assert.equal(bewaarScenario(opslag, { versie: 1 }), false);
});

test('thema: laden en bewaren, met fallback auto', async () => {
  const { laadThema, bewaarThema } = await import('../demo/opslag.js');
  const opslag = nepOpslag();
  assert.equal(laadThema(opslag), 'auto');
  assert.equal(bewaarThema(opslag, 'dark'), true);
  assert.equal(laadThema(opslag), 'dark');
  opslag.setItem('rollnest-thema', 'paars');
  assert.equal(laadThema(opslag), 'auto');
  const kapot = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(laadThema(kapot), 'auto');
  assert.equal(bewaarThema(kapot, 'light'), false);
});
