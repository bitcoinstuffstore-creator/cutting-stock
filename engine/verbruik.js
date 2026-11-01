import { EPS } from './packers.js';

// Verlies, reststuk-regel en verdeling van het verbruik per doek (spec 4.3).
export function berekenVerbruik(nest, doeken, stof, instellingen) {
  const min = instellingen.minReststukLengte;
  const perBak = [];
  const nettoPerDoek = new Map();
  let brutoLengteTotaal = 0;
  let brutoM2 = 0;
  let nettoM2 = 0;

  for (const bak of nest.bakken) {
    if (!bak.plaatsingen.length) continue;
    const restLengte = bak.lengte - bak.gebruikteLengte;
    const restIsVerlies = restLengte > EPS && restLengte < min;
    const brutoLengte = bak.gebruikteLengte + (restIsVerlies ? restLengte : 0);
    const bakBruto = (brutoLengte * bak.breedte) / 10000;
    let bakNetto = 0;
    for (const p of bak.plaatsingen) {
      const m2 = (p.w * p.h) / 10000;
      bakNetto += m2;
      nettoPerDoek.set(p.doekId, (nettoPerDoek.get(p.doekId) || 0) + m2);
    }
    perBak.push({ bakId: bak.id, brutoLengte, brutoM2: bakBruto, nettoM2: bakNetto, verliesM2: bakBruto - bakNetto, restLengte, restIsVerlies });
    brutoLengteTotaal += brutoLengte;
    brutoM2 += bakBruto;
    nettoM2 += bakNetto;
  }

  const totaal = {
    brutoM1: brutoLengteTotaal / 100,
    brutoM2,
    nettoM2,
    verliesM2: brutoM2 - nettoM2,
    verliesfactor: nettoM2 > 0 ? brutoM2 / nettoM2 : 1,
  };

  const perDoek = [];
  for (const d of doeken) {
    if (!nettoPerDoek.has(d.doekId)) continue;
    const netto = nettoPerDoek.get(d.doekId);
    const aandeel = nettoM2 > 0 ? netto / nettoM2 : 0;
    const bruto = aandeel * brutoM2;
    perDoek.push({ doekId: d.doekId, orderNr: d.orderNr, product: d.product, stof: d.stof, nettoM2: netto, aandeel, brutoM2: bruto, m1: bruto / (stof.rolbreedte / 100) });
  }

  return { perBak, totaal, doeken: perDoek };
}
