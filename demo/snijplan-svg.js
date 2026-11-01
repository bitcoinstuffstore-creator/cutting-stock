// Snijplan van één bak als inline SVG. Zuiver: geen engine-imports, geen DOM.
// De rolbreedte loopt horizontaal (x), de lengte verticaal (y). Kleuren komen uit CSS-klassen (thema-tokens).
import { esc } from './format.js';

const r2 = (v) => Math.round(v * 100) / 100;
const maat = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
// Veilig als HTML/SVG-id: alles behalve letters, cijfers, _ en - wordt _.
export const veiligId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

// doekId = `${regelIndex}:${orderNr}#${k}`
export function orderNrVan(doekId) {
  const s = String(doekId);
  const start = s.indexOf(':') + 1;
  const eind = s.lastIndexOf('#');
  return s.slice(start, eind > start ? eind : s.length);
}

// Baannummer uit stukId = `${doekId}/${i}`; n = aantal stukken (banen) van die doek.
export function baanVan(p, n) {
  if (!(n > 1)) return null;
  const i = Number(String(p.stukId).slice(String(p.doekId).length + 1));
  return Number.isInteger(i) && i > 0 ? { i, n } : null;
}

const standaardLabel = (p, baan) => [
  orderNrVan(p.doekId),
  ...(baan ? [`baan ${baan.i}/${baan.n}`] : []),
  `${maat(p.w)} × ${maat(p.h)}`,
];

/**
 * @param bak    { id, breedte, gebruikteLengte, plaatsingen[{stukId, doekId, x, y, w, h, gedraaid, vastGedraaid}] }
 * @param opties kleurVoor(doekId) → CSS-klasse (bv. 'kleur-3'); label(p) → string | string[];
 *               titel(p) → tooltip; verliesLengte: cm extra onderaan (restlengte die verlies is);
 *               refBreedte: breedte waarop de lettergrootte schaalt (standaard de bakbreedte);
 *               compact: één regel tekst, zo groot als het stuk toelaat (werkbon); id: voorvoegsel voor het pattern-id;
 *               delenVoor(doekId) → aantal stukken (banen) van die doek; standaard geteld binnen deze bak.
 *               label en titel krijgen (p, baan) mee, baan = {i, n} of null.
 */
export function snijplanSVG(bak, opties = {}) {
  const {
    kleurVoor = () => 'kleur-0',
    label = standaardLabel,
    titel,
    verliesLengte = 0,
    refBreedte = bak.breedte,
    compact = false,
    id = 'snijplan',
    delenVoor,
  } = opties;
  const teller = new Map();
  for (const p of bak.plaatsingen) teller.set(p.doekId, (teller.get(p.doekId) || 0) + 1);
  const delen = delenVoor || ((doekId) => teller.get(doekId) || 1);
  const B = bak.breedte;
  const H = Math.max(1, (bak.gebruikteLengte || 0) + (verliesLengte > 0 ? verliesLengte : 0));
  const patId = veiligId(`${id}-arcering-${bak.id}`);
  const raster = r2(refBreedte / 36);
  const fs = refBreedte * 0.05;

  const stukken = bak.plaatsingen.map((p) => {
    const baan = baanVan(p, delen(p.doekId));
    const regels = [].concat(label(p, baan)).filter((t) => t != null && t !== '').map(String);
    const tip = titel ? titel(p, baan) : `${regels.join(' · ')}${p.gedraaid || p.vastGedraaid ? ' (gedraaid)' : ''}`;
    const cx = r2(p.x + p.w / 2);
    const cy = r2(p.y + p.h / 2);
    let tekst = '';
    if (compact) {
      const lang = Math.max(1, ...regels.map((t) => t.length));
      const grootte = Math.min(p.h * 0.6, (p.w * 0.85) / (lang * 0.62), refBreedte * 0.09);
      if (regels.length && grootte >= refBreedte * 0.035) {
        tekst = `<text class="stuk-label" x="${cx}" y="${cy}" font-size="${r2(grootte)}">${esc(regels[0])}</text>`;
      }
    } else {
      const past = (t) => t.length * 0.6 * fs + fs * 0.6 <= p.w;
      // Zoveel regels als er passen (in volgorde), maximaal drie.
      let zicht = [];
      for (let n = Math.min(3, regels.length); n >= 1; n--) {
        if (p.h >= fs * (1.15 * n + 0.3) && regels.slice(0, n).every(past)) { zicht = regels.slice(0, n); break; }
      }
      if (zicht.length) {
        const y0 = cy - ((zicht.length - 1) * fs * 1.15) / 2;
        const tspans = zicht.map((t, i) => `<tspan x="${cx}" y="${r2(y0 + i * fs * 1.15)}">${esc(t)}</tspan>`).join('');
        tekst = `<text class="stuk-label" font-size="${r2(fs)}">${tspans}</text>`;
      }
    }
    const baanKlasse = baan ? ` baan baan-${baan.i % 2 ? 'oneven' : 'even'}` : '';
    const vlak = `x="${r2(p.x)}" y="${r2(p.y)}" width="${r2(p.w)}" height="${r2(p.h)}"`;
    return `<g class="${esc(kleurVoor(p.doekId))}${baanKlasse}"><title>${esc(tip)}</title>`
      + `<rect class="stuk" ${vlak}/>${baan && baan.i % 2 === 0 ? `<rect class="baan-tint" ${vlak}/>` : ''}${tekst}</g>`;
  }).join('');

  return `<svg class="snijplan-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(B)} ${r2(H)}" width="100%" preserveAspectRatio="xMidYMin meet" role="img" aria-label="Snijplan ${esc(bak.id)}: ${maat(B)} cm breed, ${maat(H)} cm lang">`
    + `<title>${esc(bak.id)}: ${maat(B)} × ${maat(H)} cm</title>`
    + `<defs><pattern id="${patId}" patternUnits="userSpaceOnUse" width="${raster}" height="${raster}">`
    + `<rect class="arcering-vlak" width="${raster}" height="${raster}"/>`
    + `<path class="arcering-lijn" d="M0 ${raster}L${raster} 0"/></pattern></defs>`
    + `<rect class="verlies" x="0" y="0" width="${r2(B)}" height="${r2(H)}" fill="url(#${patId})"/>`
    + stukken
    + `<rect class="rand" x="0" y="0" width="${r2(B)}" height="${r2(H)}"/>`
    + '</svg>';
}
