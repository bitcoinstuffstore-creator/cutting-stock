// CSV import for order lines. Lengths in cm.

export function parseGetal(tekst) {
  const t = String(tekst ?? '').trim();
  if (!/^[+-]?[\d.,]+$/.test(t)) return NaN;
  let s = t;
  if (s.includes('.') && s.includes(',')) s = s.replaceAll('.', '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replaceAll('.', '');
  else s = s.replace(',', '.');
  return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// Datum: JJJJ-MM-DD (ook met / of .), of D-M-JJJJ / DD-MM-JJJJ met -, / of . → ISO JJJJ-MM-DD; anders null.
export function parseDatum(tekst) {
  const t = String(tekst ?? '').trim();
  let j, m, d;
  let x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (x) [, j, m, d] = x;
  else if ((x = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) [, d, m, j] = x;
  else return null;
  [j, m, d] = [j, m, d].map(Number);
  const dagen = [31, (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > dagen[m - 1]) return null;
  return `${j}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const ALIASSEN = {
  orderNr: ['ordernr', 'order', 'ordernummer', 'ordernr.', 'order nr', 'order nummer', 'orderno', 'order_nr'],
  datum: ['datum', 'date', 'orderdatum'],
  product: ['product', 'type', 'producttype', 'soort'],
  stof: ['stof', 'artikel', 'doek', 'fabric', 'stofcode', 'artikelnr'],
  breedte: ['breedte', 'b', 'width', 'br'],
  hoogte: ['hoogte', 'h', 'height', 'val', 'lengte', 'hg'],
  aantal: ['aantal', 'qty', 'quantity', 'stuks', 'n', 'aant'],
};
const VERPLICHT = ['stof', 'breedte', 'hoogte'];

function kiesSeparator(kop) {
  const tel = c => kop.split(c).length - 1;
  let beste = '\t';
  for (const c of [';', ',']) if (tel(c) > tel(beste)) beste = c;
  return beste;
}

function splitRij(rij, sep) {
  const velden = [];
  let veld = '';
  let tussen = false;
  for (let i = 0; i < rij.length; i++) {
    const c = rij[i];
    if (tussen) {
      if (c === '"') {
        if (rij[i + 1] === '"') { veld += '"'; i++; } else tussen = false;
      } else veld += c;
    } else if (c === '"') tussen = true;
    else if (c === sep) { velden.push(veld); veld = ''; }
    else veld += c;
  }
  velden.push(veld);
  return velden;
}

// opties.datumVerplicht (historie-import): een ontbrekende datum is een fout in plaats van vandaag.
export function parseOrdersCSV(tekst, vandaag, opties = {}) {
  const verplicht = opties.datumVerplicht ? [...VERPLICHT, 'datum'] : VERPLICHT;
  const regels = [];
  const fouten = [];
  const lijnen = String(tekst ?? '').replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const kopIdx = lijnen.findIndex(l => l.trim() !== '');
  if (kopIdx === -1) return { regels, fouten };

  const sep = kiesSeparator(lijnen[kopIdx]);
  const kop = splitRij(lijnen[kopIdx], sep).map(k => k.trim().toLowerCase());
  const kolom = {};
  for (const [veld, namen] of Object.entries(ALIASSEN)) {
    const i = kop.findIndex(k => namen.includes(k));
    if (i !== -1) kolom[veld] = i;
  }
  const ontbreekt = verplicht.filter(v => kolom[v] === undefined);
  if (ontbreekt.length) {
    fouten.push({ regelNr: kopIdx + 1, melding: `Verplichte kolom(men) ontbreken: ${ontbreekt.join(', ')}` });
    return { regels, fouten };
  }

  for (let l = kopIdx + 1; l < lijnen.length; l++) {
    if (lijnen[l].trim() === '') continue;
    const regelNr = l + 1;
    const v = splitRij(lijnen[l], sep).map(x => x.trim());
    const get = naam => (kolom[naam] === undefined ? '' : v[kolom[naam]] ?? '');

    const stof = get('stof');
    if (!stof) { fouten.push({ regelNr, melding: 'Stof ontbreekt.' }); continue; }
    const breedte = parseGetal(get('breedte'));
    if (!(breedte > 0)) { fouten.push({ regelNr, melding: `Ongeldige breedte: "${get('breedte')}".` }); continue; }
    const hoogte = parseGetal(get('hoogte'));
    if (!(hoogte > 0)) { fouten.push({ regelNr, melding: `Ongeldige hoogte: "${get('hoogte')}".` }); continue; }
    let aantal = 1;
    if (get('aantal') !== '') {
      aantal = parseGetal(get('aantal'));
      if (!(aantal >= 1) || !Number.isInteger(aantal)) { fouten.push({ regelNr, melding: `Ongeldig aantal: "${get('aantal')}".` }); continue; }
    }
    let datum = vandaag;
    if (get('datum') !== '') {
      datum = parseDatum(get('datum'));
      if (!datum) { fouten.push({ regelNr, melding: `Ongeldige datum: "${get('datum')}" (gebruik bijvoorbeeld 2026-11-02 of 2-11-2026).` }); continue; }
    } else if (opties.datumVerplicht) {
      fouten.push({ regelNr, melding: 'Datum ontbreekt (nodig voor de historie).' });
      continue;
    }
    regels.push({
      orderNr: get('orderNr'),
      datum,
      product: get('product'),
      stof,
      breedte,
      hoogte,
      aantal,
    });
  }
  return { regels, fouten };
}
