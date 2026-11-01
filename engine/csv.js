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

export function parseOrdersCSV(tekst, vandaag) {
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
  const ontbreekt = VERPLICHT.filter(v => kolom[v] === undefined);
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
    regels.push({
      orderNr: get('orderNr'),
      datum: get('datum') || vandaag,
      product: get('product'),
      stof,
      breedte,
      hoogte,
      aantal,
    });
  }
  return { regels, fouten };
}
