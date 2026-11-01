import test from 'node:test';
import assert from 'node:assert/strict';
import { snijplanSVG, orderNrVan, veiligId } from '../demo/snijplan-svg.js';

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

test('banen van dezelfde doek: baanlabel, tooltip en afwisselende klasse', () => {
  const banen = {
    id: 'nieuw-2', breedte: 120, lengte: 4000, gebruikteLengte: 300,
    plaatsingen: [
      { stukId: '4:Z-9#1/1', doekId: '4:Z-9#1', x: 0, y: 0, w: 110, h: 300, gedraaid: false },
      { stukId: '4:Z-9#1/2', doekId: '4:Z-9#1', x: 0, y: 300, w: 110, h: 300, gedraaid: false },
    ],
  };
  const svg = snijplanSVG({ ...banen, gebruikteLengte: 600 }, { kleurVoor: () => 'kleur-2' });
  assert.equal(tel(svg, 'class="kleur-2 baan baan-oneven"'), 1);
  assert.equal(tel(svg, 'class="kleur-2 baan baan-even"'), 1);
  assert.equal(tel(svg, 'class="baan-tint"'), 1);
  assert.ok(svg.includes('baan 1/2'));
  assert.ok(svg.includes('baan 2/2'));
  assert.match(svg, /<title>Z-9 · baan 2\/2 · 110 × 300<\/title>/);
  // Aantal banen kan van buiten komen (banen over meerdere bakken).
  const een = snijplanSVG({ ...banen, plaatsingen: banen.plaatsingen.slice(1) }, { delenVoor: () => 4 });
  assert.ok(een.includes('baan 2/4'));
  // Een doek uit één stuk krijgt geen baanklasse.
  assert.ok(!snijplanSVG(bak, {}).includes('baan'));
});

test('svg schaalt mee: geen vaste hoogte, geen vervorming', () => {
  const svg = snijplanSVG(bak, {});
  const root = svg.match(/^<svg[^>]*>/)[0];
  assert.ok(!/\sheight=/.test(root));
  assert.ok(!svg.includes('preserveAspectRatio="none"'));
});

test('veiligId', () => {
  assert.equal(veiligId('R "1"/a'), 'R__1__a');
});

test('F3: vast gedraaid stuk heet ook gedraaid in de tooltip', () => {
  const bak = { id: 'r', breedte: 250, gebruikteLengte: 304, plaatsingen: [{ stukId: '0:A#1/1', doekId: '0:A#1', x: 0, y: 0, w: 212, h: 304, gedraaid: false, vastGedraaid: true }] };
  assert.match(snijplanSVG(bak), /\(gedraaid\)/);
});
