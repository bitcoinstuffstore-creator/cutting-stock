// Enige publieke ingang van de rekenkern (spec 4.6).
import { maakStukken } from './snijmaat.js';
import { nestStof } from './nesting.js';
import { berekenVerbruik } from './verbruik.js';
import { berekenNormen } from './normen.js';
import { berekenInkoop } from './inkoop.js';
import { zoekStof, geldigeStof } from './catalogus.js';
import { nl } from './tekst.js';

export { parseOrdersCSV } from './csv.js';
export { maatklasse } from './normen.js';
export { STRATEGIEEN } from './nesting.js';

const sleutel = (code) => String(code ?? '').trim().toLowerCase();

// Eerste stof per code telt (hoofdletterongevoelig); dubbele krijgen een melding.
function uniekeStoffen(lijst) {
  const gezien = new Map();
  const stoffen = [];
  const waarschuwingen = [];
  for (const stof of lijst || []) {
    const k = sleutel(stof?.code);
    if (gezien.has(k)) {
      const eerste = gezien.get(k);
      waarschuwingen.push({ soort: 'dubbeleStof', orderNr: null, bron: 'stoffen', melding: `Stofcode ${stof.code} staat meer dan één keer in de stoffen; RollNest rekent met de eerste (${eerste.naam || eerste.code}).` });
      continue;
    }
    gezien.set(k, stof);
    stoffen.push(stof);
  }
  return { stoffen, waarschuwingen };
}

// Dubbele voorraad-ids krijgen voor de bak een achtervoegsel, zodat bakken niet botsen.
function uniekeVoorraad(lijst) {
  const gebruikt = new Set();
  return (lijst || []).map((v) => {
    let id = String(v.id);
    for (let n = 2; gebruikt.has(id); n++) id = `${v.id} (${n})`;
    gebruikt.add(id);
    return id === String(v.id) ? v : { ...v, id, voorraadId: v.id };
  });
}

export function analyseer(scenario) {
  const inst = scenario.instellingen || {};
  const { stoffen, waarschuwingen: wStof } = uniekeStoffen(scenario.stoffen);
  const sc = { ...scenario, stoffen };
  const { doeken, stukken, waarschuwingen: wOpen } = maakStukken(scenario.openOrders || [], sc);
  const normen = berekenNormen(sc);
  const voorraadAlle = uniekeVoorraad(scenario.voorraad);

  const waarschuwingen = [
    ...wStof,
    ...wOpen.map((w) => ({ ...w, bron: 'open' })),
    ...normen.waarschuwingen.map((w) => ({ ...w, bron: 'historie' })),
  ];

  const perStof = {};
  const alleDoeken = [];
  let kosten = 0;
  let berekendEuro = 0;
  let gevoelEuro = 0;
  let brutoM2 = 0;
  let nettoM2 = 0;

  for (const stof of stoffen) {
    if (!geldigeStof(stof)) {
      // Orders op deze stof hebben al een eigen melding; anders één melding voor de stof zelf.
      const gemeld = (scenario.openOrders || []).some((r) => zoekStof(stoffen, r.stof) === stof);
      if (!gemeld) waarschuwingen.push({ soort: 'ongeldigeStof', orderNr: null, bron: 'stoffen', melding: `Stof ${stof.naam || stof.code} heeft geen geldige rolbreedte, rollengte of prijs en telt niet mee.` });
      continue;
    }
    const stofStukken = stukken.filter((s) => s.stof === stof.code);
    const stofDoeken = doeken.filter((d) => d.stof === stof.code);
    const voorraad = voorraadAlle.filter((v) => zoekStof(stoffen, v.stof) === stof);
    const snijplan = nestStof(stofStukken, stof, voorraad, inst);
    const verbruik = berekenVerbruik(snijplan, stofDoeken, stof, inst);
    const inkoop = berekenInkoop({
      stof, nest: snijplan, verbruik,
      verwachtPerMaand: normen.verwachtPerMaand[stof.code] ?? 0,
      gevoelM1: scenario.gevoel?.[stof.code],
      instellingen: inst,
    });
    perStof[stof.code] = { stof, snijplan, verbruik, inkoop };
    alleDoeken.push(...verbruik.doeken);

    // Eén melding per orderregel, niet per stuk.
    const gemeld = new Set();
    for (const p of snijplan.onplaatsbaar) {
      const regelIndex = Number(String(p.doekId).split(':')[0]);
      if (gemeld.has(regelIndex)) continue;
      gemeld.add(regelIndex);
      waarschuwingen.push({ soort: 'onplaatsbaar', orderNr: p.orderNr, regelIndex, bron: 'open', melding: `Order ${p.orderNr}: stuk ${nl(p.w)} x ${nl(p.h)} cm past niet op ${stof.naam}.` });
    }

    kosten += inkoop.kosten;
    berekendEuro += inkoop.hardBrutoM1 * stof.prijsPerM1;
    gevoelEuro += inkoop.gevoelM1 * stof.prijsPerM1;
    brutoM2 += verbruik.totaal.brutoM2;
    nettoM2 += verbruik.totaal.nettoM2;
  }

  const verschilEuro = gevoelEuro - berekendEuro;
  const totalen = {
    kosten, gevoelEuro, berekendEuro, verschilEuro,
    verschilPct: berekendEuro > 0 ? (verschilEuro / berekendEuro) * 100 : 0,
    verliesfactor: nettoM2 > 0 ? brutoM2 / nettoM2 : 1,
  };

  return { waarschuwingen, perStof, doeken: alleDoeken, normen: normen.normen, maandverbruik: normen.maandverbruik, totalen };
}
