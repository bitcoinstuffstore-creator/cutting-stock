// Rijen en CSV voor het resultaatscherm. Zuiver: geen engine-imports, geen DOM.
import { naarCSV } from './format.js';

// Afronden op 2 decimalen, symmetrisch rond nul (zoals de getallen op het scherm).
const r2 = (v) => (Number.isFinite(v) ? (Math.sign(v) * Math.round(Math.abs(v) * 100)) / 100 : null);

// Verschil vuistregel − berekend (in €): positief = te veel ingekocht, negatief = te weinig.
export function verschilSoort(euro) {
  if (!Number.isFinite(euro) || Math.abs(euro) < 0.005) return { soort: 'gelijk', tekst: 'gelijk' };
  return euro > 0 ? { soort: 'te-veel', tekst: 'te veel' } : { soort: 'te-weinig', tekst: 'te weinig' };
}

// Verbruik per doek, aangevuld met ordermaat en snijmaat. doekId = `${regelIndex}:${orderNr}#${k}`.
export function doekRijen(resultaat, scenario) {
  const orders = scenario.openOrders || [];
  const producten = new Map((scenario.producttypes || []).map((p) => [String(p.code).toLowerCase(), p]));
  return resultaat.doeken.map((d) => {
    const regel = orders[Number(String(d.doekId).split(':')[0])];
    const product = producten.get(String(d.product).toLowerCase());
    const klopt = regel && regel.orderNr === d.orderNr;
    const ordermaat = klopt ? { b: regel.breedte, h: regel.hoogte } : null;
    const snijmaat = ordermaat && product
      ? { b: ordermaat.b + (product.toeslagBreedte || 0), h: ordermaat.h + (product.toeslagHoogte || 0) }
      : null;
    return { ...d, productNaam: product?.naam ?? d.product, ordermaat, snijmaat };
  });
}

export function inkoopCSV(resultaat) {
  const rijen = Object.values(resultaat.perStof);
  return naarCSV([
    { kop: 'Stofcode', waarde: (r) => r.stof.code },
    { kop: 'Stof', waarde: (r) => r.stof.naam },
    { kop: 'Harde behoefte m1', waarde: (r) => r2(r.inkoop.hardBrutoM1) },
    { kop: 'Verwacht m1', waarde: (r) => r2(r.inkoop.verwachtM1) },
    { kop: 'Voorraad over m1', waarde: (r) => r2(r.inkoop.restVoorraadM1) },
    { kop: 'Te bestellen rollen', waarde: (r) => r.inkoop.teBestellenRollen },
    { kop: 'Te bestellen m1', waarde: (r) => r2(r.inkoop.teBestellenM1) },
    { kop: 'Kosten EUR', waarde: (r) => r2(r.inkoop.kosten) },
    { kop: 'Vuistregel m1', waarde: (r) => r2(r.inkoop.gevoelM1) },
    { kop: 'Vuistregel bron', waarde: (r) => r.inkoop.gevoelBron },
    { kop: 'Verschil m1', waarde: (r) => r2(r.inkoop.verschilM1) },
    { kop: 'Verschil EUR', waarde: (r) => r2(r.inkoop.verschilEuro) },
    { kop: 'Vuistregel koopt', waarde: (r) => verschilSoort(r.inkoop.verschilEuro).tekst },
  ], rijen);
}

export function doekenCSV(rijen) {
  return naarCSV([
    { kop: 'Order', waarde: (r) => r.orderNr },
    { kop: 'Product', waarde: (r) => r.productNaam },
    { kop: 'Stof', waarde: (r) => r.stof },
    { kop: 'Breedte cm', waarde: (r) => r.ordermaat?.b },
    { kop: 'Hoogte cm', waarde: (r) => r.ordermaat?.h },
    { kop: 'Snijbreedte cm', waarde: (r) => r.snijmaat?.b },
    { kop: 'Snijhoogte cm', waarde: (r) => r.snijmaat?.h },
    { kop: 'Netto m2', waarde: (r) => r2(r.nettoM2) },
    { kop: 'Bruto m2', waarde: (r) => r2(r.brutoM2) },
    { kop: 'm1', waarde: (r) => r2(r.m1) },
  ], rijen);
}
