import { maakStukken } from './snijmaat.js';
import { nestStof } from './nesting.js';
import { berekenVerbruik } from './verbruik.js';

const KLASSEN = ['<150', '150-249', '250-349', '>=350'];

export function maatklasse(breedte) {
  if (breedte < 150) return '<150';
  if (breedte < 250) return '150-249';
  if (breedte < 350) return '250-349';
  return '>=350';
}

function volgendeMaand(m) {
  const [j, mm] = m.split('-').map(Number);
  return mm === 12 ? `${j + 1}-01` : `${j}-${String(mm + 1).padStart(2, '0')}`;
}

// Verbruiksnormen en verwacht maandverbruik uit de historie (spec 4.4).
export function berekenNormen(scenario) {
  const historie = scenario.historie || [];
  const inst = scenario.instellingen || {};
  const { doeken, stukken, waarschuwingen } = maakStukken(historie, scenario);

  const maandVan = (d) => d.datum.slice(0, 7);
  const maandenMetData = doeken.map(maandVan).sort();
  const maanden = [];
  if (maandenMetData.length) {
    const laatste = maandenMetData[maandenMetData.length - 1];
    for (let m = maandenMetData[0]; m <= laatste; m = volgendeMaand(m)) maanden.push(m);
  }

  const doekMap = new Map(doeken.map((d) => [d.doekId, d]));
  const maandverbruik = {};
  const verwachtPerMaand = {};
  const normen = [];
  const aantalVenster = Math.min(inst.historieMaanden ?? 0, maanden.length);

  for (const stof of scenario.stoffen) {
    const stofDoeken = doeken.filter((d) => d.stof === stof.code);
    const stofStukken = stukken.filter((s) => s.stof === stof.code);
    const perMaand = new Map(maanden.map((m) => [m, 0]));
    let somBruto = 0;
    let somNetto = 0;
    const perDoek = []; // {doek, nettoM2, m1}

    for (const m of maanden) {
      const mDoeken = stofDoeken.filter((d) => maandVan(d) === m);
      if (!mDoeken.length) continue;
      const ids = new Set(mDoeken.map((d) => d.doekId));
      const mStukken = stofStukken.filter((s) => ids.has(s.doekId));
      const nest = nestStof(mStukken, stof, [], inst);
      const v = berekenVerbruik(nest, mDoeken, stof, inst);
      perMaand.set(m, v.totaal.brutoM1);
      somBruto += v.totaal.brutoM2;
      somNetto += v.totaal.nettoM2;
      for (const d of v.doeken) perDoek.push({ doek: doekMap.get(d.doekId), nettoM2: d.nettoM2, m1: d.m1 });
    }

    maandverbruik[stof.code] = maanden.map((m) => ({ maand: m, brutoM1: perMaand.get(m) }));
    const venster = maanden.slice(maanden.length - aantalVenster);
    verwachtPerMaand[stof.code] = aantalVenster > 0 ? venster.reduce((a, m) => a + perMaand.get(m), 0) / aantalVenster : 0;

    const verliesfactor = somNetto > 0 ? somBruto / somNetto : 1;
    const groepen = new Map();
    for (const p of perDoek) {
      const sleutel = `${p.doek.product}\u0000${maatklasse(p.doek.breedte)}`;
      if (!groepen.has(sleutel)) groepen.set(sleutel, { product: p.doek.product, klasse: maatklasse(p.doek.breedte), n: 0, netto: 0, m1: 0 });
      const g = groepen.get(sleutel);
      g.n++;
      g.netto += p.nettoM2;
      g.m1 += p.m1;
    }
    for (const g of groepen.values()) {
      normen.push({ stof: stof.code, product: g.product, maatklasse: g.klasse, aantalDoeken: g.n, gemNettoM2: g.netto / g.n, gemM1: g.m1 / g.n, verliesfactor });
    }
  }

  normen.sort((a, b) => (a.stof < b.stof ? -1 : a.stof > b.stof ? 1 : 0) || (a.product < b.product ? -1 : a.product > b.product ? 1 : 0) || KLASSEN.indexOf(a.maatklasse) - KLASSEN.indexOf(b.maatklasse));
  return { normen, maandverbruik, verwachtPerMaand, waarschuwingen };
}
