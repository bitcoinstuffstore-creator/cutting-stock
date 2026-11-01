// Maakt van elk (geïmporteerd, opgeslagen of oud) scenario een scenario waarmee de UI en de kern kunnen werken.
// Zuiver: geen DOM, geen engine-imports.
export const STANDAARD_INSTELLINGEN = { naadtoeslag: 4, snijspeling: 0, minReststukLengte: 50, gevoelToeslag: 15, historieMaanden: 3, horizonMaanden: 1 };
const HORIZONNEN = [0, 1, 3];
export const DRAAIEN = ['nooit', 'alsTeBreed', 'vrij'];
// Screens en rolgordijnen bestaan niet uit genaaide banen; zonneschermdoek wel.
const ZONDER_BANEN = /screen|rolgordijn/i;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const lijst = (x) => (Array.isArray(x) ? x.filter(isObject) : []);
const tekst = (x, standaard = '') => (x == null ? standaard : String(x));
function getal(x, standaard = null) {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) ? n : standaard;
}

function orderregel(r) {
  return {
    orderNr: tekst(r.orderNr),
    datum: tekst(r.datum),
    product: tekst(r.product),
    stof: tekst(r.stof),
    breedte: getal(r.breedte),
    hoogte: getal(r.hoogte),
    aantal: getal(r.aantal, 1),
  };
}

export function normaliseer(sc) {
  const bron = isObject(sc) ? sc : {};
  const inst = isObject(bron.instellingen) ? bron.instellingen : {};
  const instellingen = {};
  for (const [k, std] of Object.entries(STANDAARD_INSTELLINGEN)) {
    const n = getal(inst[k]);
    instellingen[k] = n != null && n >= 0 ? n : std;
  }
  if (!HORIZONNEN.includes(instellingen.horizonMaanden)) instellingen.horizonMaanden = STANDAARD_INSTELLINGEN.horizonMaanden;
  if (instellingen.historieMaanden < 1) instellingen.historieMaanden = STANDAARD_INSTELLINGEN.historieMaanden;

  const gevoel = {};
  if (isObject(bron.gevoel)) {
    for (const [code, m1] of Object.entries(bron.gevoel)) {
      const n = getal(m1);
      if (typeof m1 === 'number' && n != null && n >= 0) gevoel[code] = n;
    }
  }

  return {
    versie: 1,
    stoffen: lijst(bron.stoffen).map((s) => ({
      code: tekst(s.code),
      naam: tekst(s.naam, tekst(s.code)),
      rolbreedte: getal(s.rolbreedte),
      rollengte: getal(s.rollengte),
      prijsPerM1: getal(s.prijsPerM1, 0),
      // Oud scenario: draaienToegestaan (boolean) → true = vrij, false = nooit.
      draaien: DRAAIEN.includes(s.draaien) ? s.draaien : s.draaienToegestaan ? 'vrij' : 'nooit',
    })),
    producttypes: lijst(bron.producttypes).map((p) => ({
      code: tekst(p.code),
      naam: tekst(p.naam, tekst(p.code)),
      toeslagBreedte: getal(p.toeslagBreedte, 0),
      toeslagHoogte: getal(p.toeslagHoogte, 0),
      banenToegestaan: typeof p.banenToegestaan === 'boolean' ? p.banenToegestaan : !ZONDER_BANEN.test(`${tekst(p.code)} ${tekst(p.naam)}`),
    })),
    openOrders: lijst(bron.openOrders).map(orderregel),
    historie: lijst(bron.historie).map(orderregel),
    voorraad: lijst(bron.voorraad).map((v) => ({
      id: tekst(v.id),
      stof: tekst(v.stof),
      soort: v.soort === 'reststuk' ? 'reststuk' : 'rol',
      breedte: getal(v.breedte),
      lengte: getal(v.lengte),
    })),
    gevoel,
    instellingen,
  };
}
