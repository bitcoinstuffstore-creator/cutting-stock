import test from 'node:test';
import assert from 'node:assert/strict';
import { getal, euro, esc, naarCSV, leesGetal, invoer } from '../demo/format.js';

test('getal in nl-NL', () => {
  assert.equal(getal(1234.5), '1.234,50');
  assert.equal(getal(-3, 0), '-3');
  assert.equal(getal(0.005, 2), '0,01');
});

test('euro met gewone spatie', () => {
  assert.equal(euro(510), '€ 510,00');
  assert.equal(euro(1234.5), '€ 1.234,50');
});

test('esc ontsnapt alle HTML-tekens', () => {
  assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  assert.equal(esc(null), '');
  assert.equal(esc(5), '5');
});

test('naarCSV: puntkomma, kommagetal en quotes', () => {
  const kolommen = [{ kop: 'kop', waarde: (r) => r.v }];
  assert.equal(naarCSV(kolommen, [{ v: 'a;b' }]), 'kop\n"a;b"');
  assert.equal(naarCSV(kolommen, [{ v: 2.5 }]), 'kop\n2,5');
  assert.equal(naarCSV(kolommen, [{ v: 'zeg "hoi"' }]), 'kop\n"zeg ""hoi"""');
  assert.equal(naarCSV(kolommen, [{ v: 'a\nb' }]), 'kop\n"a\nb"');
  const twee = [{ kop: 'a', waarde: (r) => r.a }, { kop: 'b', waarde: (r) => r.b }];
  assert.equal(naarCSV(twee, [{ a: 1, b: null }, { a: 'x', b: 3 }]), 'a;b\n1;\nx;3');
});

test('leesGetal leest nl- en en-notatie', () => {
  assert.equal(leesGetal('12,5'), 12.5);
  assert.equal(leesGetal(' 200 '), 200);
  assert.equal(leesGetal('1.250'), 1250);
  assert.equal(leesGetal('1.250,5'), 1250.5);
  assert.equal(leesGetal('2.5'), 2.5);
  assert.equal(leesGetal(''), null);
  assert.ok(Number.isNaN(leesGetal('abc')));
});

test('invoer toont getallen met komma', () => {
  assert.equal(invoer(12.5), '12,5');
  assert.equal(invoer(200), '200');
  assert.equal(invoer(null), '');
  assert.equal(invoer(undefined), '');
});
