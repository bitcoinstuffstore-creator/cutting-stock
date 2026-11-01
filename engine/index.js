// Enige publieke ingang van de rekenkern (spec 4.6).
import { maakStukken } from './snijmaat.js';
import { nestStof } from './nesting.js';
import { berekenVerbruik } from './verbruik.js';
import { berekenNormen } from './normen.js';
import { berekenInkoop } from './inkoop.js';
import { zoekStof } from './catalogus.js';

export { parseOrdersCSV } from './csv.js';
export { maatklasse } from './normen.js';
export { STRATEGIEEN } from './nesting.js';

export function analyseer(scenario) {
  const inst = scenario.instellingen || {};
  const stoffen = scenario.stoffen || [];
  const { doeken, stukken, waarschuwingen: wOpen } = maakStukken(scenario.openOrders || [], scenario);
  const normen = berekenNormen(scenario);

  const waarschuwingen = [
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
    const stofStukken = stukken.filter((s) => s.stof === stof.code);
    const stofDoeken = doeken.filter((d) => d.stof === stof.code);
    const voorraad = (scenario.voorraad || []).filter((v) => zoekStof(stoffen, v.stof)?.code === stof.code);
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

    for (const p of snijplan.onplaatsbaar) {
      waarschuwingen.push({ soort: 'onplaatsbaar', orderNr: p.orderNr, melding: `Order ${p.orderNr}: stuk ${p.w} x ${p.h} cm past niet op ${stof.naam}.`, bron: 'open' });
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
