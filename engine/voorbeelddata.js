// Fictieve voorbeelddata voor "Zonwering Voorbeeld BV". Zuiver data, geen engine-imports.
import { mulberry32 } from './random.js';

const STOFFEN = [
  { code: 'S5A', naam: 'Screen 5% Antraciet', rolbreedte: 250, rollengte: 30, prijsPerM1: 14, draaienToegestaan: true },
  { code: 'S3W', naam: 'Screen 3% Wit', rolbreedte: 320, rollengte: 30, prijsPerM1: 17, draaienToegestaan: true },
  { code: 'VDG', naam: 'Verduisterend Grijs', rolbreedte: 300, rollengte: 40, prijsPerM1: 12, draaienToegestaan: true },
  { code: 'RLZ', naam: 'Rolgordijn Linnen Zand', rolbreedte: 200, rollengte: 50, prijsPerM1: 9, draaienToegestaan: false },
  { code: 'ZSB', naam: 'Zonneschermdoek Streep Blauw', rolbreedte: 120, rollengte: 40, prijsPerM1: 11, draaienToegestaan: false },
];

const PRODUCTTYPES = [
  { code: 'screen', naam: 'Screen', toeslagBreedte: 4, toeslagHoogte: 12 },
  { code: 'rolgordijn', naam: 'Rolgordijn', toeslagBreedte: 2, toeslagHoogte: 15 },
  { code: 'knikarm', naam: 'Knikarmscherm', toeslagBreedte: 6, toeslagHoogte: 20 },
  { code: 'uitval', naam: 'Uitvalscherm', toeslagBreedte: 4, toeslagHoogte: 15 },
];

// Productmix: [product, gewicht, [stof, gewicht][], B-bereik, H-bereik]
const MIX = [
  ['screen', 46, [['S5A', 4], ['S3W', 3], ['VDG', 1]], [80, 400], [100, 300]],
  ['rolgordijn', 30, [['RLZ', 4], ['VDG', 1]], [50, 250], [80, 280]],
  ['knikarm', 15, [['ZSB', 1], ['VDG', 4]], [200, 600], [150, 350]],
  ['uitval', 8, [['ZSB', 1]], [80, 300], [100, 250]],
];

const HOOGTE_STD = 0.9;
const PASSEND = 0.95;
const MAANDDAGEN = [31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30]; // 2025-11 .. 2026-10 (geen schrikkeljaar)
const HISTORIE_MAANDEN = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const MAAND_AANTAL = [34, 31, 36, 44, 70, 86, 88, 76, 52, 42, 38, 33];

export function voorbeeldScenario() {
  const rnd = mulberry32(2026);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const stap5 = (a, b) => 5 * int(Math.ceil(a / 5), Math.floor(b / 5));
  const kies = (lijst) => {
    const tot = lijst.reduce((s, x) => s + x[1], 0);
    let r = rnd() * tot;
    for (const x of lijst) { r -= x[1]; if (r < 0) return x; }
    return lijst[lijst.length - 1];
  };
  const pad = (n) => String(n).padStart(2, '0');

  const hoogteStd = (hb) => { const lijst = [150, 200, 250, 300].filter((h) => h >= hb[0] && h <= hb[1]); return lijst[int(0, lijst.length - 1)]; };
  const maakRegel = (orderNr, datum) => {
    const [product, , stoffen, bb, hb] = kies(MIX);
    const stof = kies(stoffen)[0];
    const r = rnd();
    const aantal = r < 0.72 ? 1 : r < 0.88 ? 2 : r < 0.96 ? 3 : 4;
    // Veel orders hebben een maat die netjes in de rolbreedte past (gangbare standaardmaten).
    const st = STOFFEN.find((x) => x.code === stof);
    const pt = PRODUCTTYPES.find((x) => x.code === product);
    let breedte = stap5(bb[0], bb[1]);
    if (rnd() < PASSEND) {
      // Gangbare maten: het doek of de banen vullen de rolbreedte (bijna) precies.
      const rb = st.rolbreedte;
      const opties = [];
      const banen = stof === 'ZSB' && product === 'knikarm'; // streepdoek: n banen naast elkaar
      for (let n = 1; n <= 5; n++) {
        const totaal = banen ? n * rb - (n - 1) * 4 : Math.floor(rb / n); // snijbreedte van het doek, of 1/n rolbreedte
        const b = totaal - pt.toeslagBreedte - int(0, 2);
        if ((banen || n <= 3) && b >= bb[0] && b <= bb[1]) opties.push(b);
      }
      if (opties.length) breedte = opties[int(0, opties.length - 1)];
    }
    return { orderNr, datum, product, stof, breedte, hoogte: rnd() < HOOGTE_STD ? hoogteStd(hb) : stap5(hb[0], hb[1]), aantal };
  };

  const openOrders = [];
  for (let i = 0; i < 60; i++) {
    openOrders.push(maakRegel(`O-2611-${pad(i + 1)}`, `2026-11-${pad(2 + Math.floor(i / 5))}`));
  }
  // Garandeer een breed knikarmscherm op streepdoek (banen).
  const idx = openOrders.findIndex((r) => r.product === 'knikarm' && r.stof === 'ZSB');
  const ankerIdx = idx >= 0 ? idx : 0;
  openOrders[ankerIdx] = { ...openOrders[ankerIdx], product: 'knikarm', stof: 'ZSB', breedte: Math.max(openOrders[ankerIdx].breedte, 500), aantal: 1 };

  const historie = [];
  HISTORIE_MAANDEN.forEach((maand, m) => {
    for (let i = 0; i < MAAND_AANTAL[m]; i++) {
      historie.push(maakRegel(`H-${maand.replace('-', '')}-${pad(i + 1)}`, `${maand}-${pad(int(1, MAANDDAGEN[m]))}`));
    }
  });

  const voorraad = [
    { id: 'R-S5A-1', stof: 'S5A', soort: 'rol', breedte: 250, lengte: 3000 },
    { id: 'R-S5A-2', stof: 'S5A', soort: 'rol', breedte: 250, lengte: 1150 },
    { id: 'R-S3W-1', stof: 'S3W', soort: 'rol', breedte: 320, lengte: 1800 },
    { id: 'R-VDG-1', stof: 'VDG', soort: 'rol', breedte: 300, lengte: 4000 },
    { id: 'R-RLZ-1', stof: 'RLZ', soort: 'rol', breedte: 200, lengte: 2300 },
    { id: 'RS-S3W-1', stof: 'S3W', soort: 'reststuk', breedte: 320, lengte: 260 },
    { id: 'RS-VDG-1', stof: 'VDG', soort: 'reststuk', breedte: 300, lengte: 180 },
    { id: 'RS-RLZ-1', stof: 'RLZ', soort: 'reststuk', breedte: 140, lengte: 310 },
    { id: 'RS-ZSB-1', stof: 'ZSB', soort: 'reststuk', breedte: 120, lengte: 420 },
    { id: 'RS-ZSB-2', stof: 'ZSB', soort: 'reststuk', breedte: 85, lengte: 230 },
  ];

  return {
    versie: 1,
    stoffen: STOFFEN.map((s) => ({ ...s })),
    producttypes: PRODUCTTYPES.map((p) => ({ ...p })),
    openOrders,
    historie,
    voorraad,
    gevoel: {},
    instellingen: { naadtoeslag: 4, snijspeling: 0, minReststukLengte: 50, gevoelToeslag: 15, historieMaanden: 3, horizonMaanden: 1 },
  };
}
