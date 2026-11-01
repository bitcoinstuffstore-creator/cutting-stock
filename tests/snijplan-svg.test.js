import test from 'node:test';
import assert from 'node:assert/strict';
import { snijplanSVG, orderNrVan } from '../demo/snijplan-svg.js';

const bak = {
  id: 'nieuw-1', soort: 'nieuw', voorraadId: null, breedte: 320, lengte: 3000, gebruikteLengte: 200,
  plaatsingen: [
    { stukId: '0:<x>#1/1', doekId: '0:<x>#1', x: 0, y: 0, w: 150, h: 120, gedraaid: false },
    { stukId: '1:O-2#1/1', doekId: '1:O-2#1', x: 150, y: 0, w: 170, h: 200, gedraaid: true },
    { stukId: '2:O-3#1/1', doekId: '2:O-3#1', x: 0, y: 120, w: 150, h: 80, gedraaid: false },
  ],
};

const tel = (s, sub) => s.split(sub).length - 1;

test('één stuk per plaatsing, één verliesvlak, viewBox breedte x gebruikte lengte', () => {
  const svg = snijplanSVG(bak, { kleurVoor: () => 'kleur-0' });
  assert.equal(tel(svg, 'class="stuk"'), 3);
  assert.equal(tel(svg, 'class="verlies"'), 1);
  assert.match(svg, /viewBox="0 0 320 200"/);
  assert.match(svg, /width="100%"/);
  assert.match(svg, /<pattern /);
});

test('labels en tooltips zijn HTML-escaped', () => {
  const svg = snijplanSVG(bak, {});
  assert.ok(svg.includes('&lt;x&gt;'));
  assert.ok(!svg.includes('<x>'));
  assert.equal(tel(svg, '<title>'), 3 + 1); // één per stuk + één voor de hele rol
});

test('standaardlabel: ordernummer en maat; kleurklasse per doek', () => {
  const svg = snijplanSVG(bak, { kleurVoor: (id) => (id === '1:O-2#1' ? 'kleur-5' : 'kleur-1') });
  assert.ok(svg.includes('O-2'));
  assert.ok(svg.includes('170 × 200'));
  assert.equal(tel(svg, 'class="kleur-5"'), 1);
  assert.equal(tel(svg, 'class="kleur-1"'), 2);
});

test('verlieslengte verlengt de viewBox (restlengte die als verlies telt)', () => {
  const svg = snijplanSVG(bak, { verliesLengte: 30 });
  assert.match(svg, /viewBox="0 0 320 230"/);
});

test('eigen label (string of regels) en te kleine stukken krijgen geen tekst', () => {
  const klein = { ...bak, plaatsingen: [...bak.plaatsingen, { stukId: '3:K#1/1', doekId: '3:K#1', x: 300, y: 190, w: 4, h: 4, gedraaid: false }] };
  const svg = snijplanSVG(klein, { label: (p) => `#${p.stukId.slice(0, 1)}` });
  assert.ok(svg.includes('#0'));
  assert.equal(tel(svg, '<text'), 3); // het stukje van 4 x 4 krijgt alleen een tooltip
  assert.equal(tel(svg, '<title>'), 4 + 1);
});

test('bak zonder plaatsingen geeft een geldige lege svg', () => {
  const svg = snijplanSVG({ ...bak, plaatsingen: [], gebruikteLengte: 0 }, {});
  assert.equal(tel(svg, 'class="stuk"'), 0);
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
});

test('pattern-id is uniek per bak en veilig', () => {
  const svg = snijplanSVG({ ...bak, id: 'R "1"' }, { id: 'werkbon' });
  const id = svg.match(/<pattern id="([^"]*)"/)[1];
  assert.match(id, /^[A-Za-z0-9_-]+$/);
  assert.ok(svg.includes(`url(#${id})`));
});

test('orderNrVan haalt het ordernummer uit een doekId', () => {
  assert.equal(orderNrVan('12:O-2611-01#3'), 'O-2611-01');
  assert.equal(orderNrVan('3:A#B#2'), 'A#B');
});
