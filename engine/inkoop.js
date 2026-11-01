// Inkoopadvies per stof (spec 4.5). Lengtes in m, bakken in cm.

export function berekenInkoop({ stof, nest, verbruik, verwachtPerMaand, gevoelM1, instellingen }) {
  const hardBrutoM1 = verbruik.totaal.brutoM1;
  const nieuweRollenHard = nest.nieuweRollen;

  let restCm = 0;
  for (const b of nest.bakken) {
    if (b.soort !== 'rol' && b.soort !== 'nieuw') continue;
    const rest = b.lengte - b.gebruikteLengte;
    if (rest >= instellingen.minReststukLengte) restCm += rest;
  }
  const restVoorraadM1 = restCm / 100;

  const verwachtM1 = (verwachtPerMaand || 0) * (instellingen.horizonMaanden || 0);
  const extraM1 = Math.max(0, verwachtM1 - restVoorraadM1);
  const teBestellenRollen = nieuweRollenHard + Math.ceil(extraM1 / stof.rollengte - 1e-9);
  const teBestellenM1 = teBestellenRollen * stof.rollengte;
  const kosten = teBestellenM1 * stof.prijsPerM1;

  const eigen = typeof gevoelM1 === 'number' && Number.isFinite(gevoelM1) && gevoelM1 >= 0;
  const gevoel = eigen
    ? gevoelM1
    : (verbruik.totaal.nettoM2 * (1 + instellingen.gevoelToeslag / 100)) / (stof.rolbreedte / 100);
  const verschilM1 = gevoel - hardBrutoM1;

  return {
    stof: stof.code, hardBrutoM1, nieuweRollenHard, restVoorraadM1, verwachtM1, extraM1,
    teBestellenRollen, teBestellenM1, kosten,
    gevoelM1: gevoel, gevoelBron: eigen ? 'eigen' : 'toeslag',
    verschilM1, verschilEuro: verschilM1 * stof.prijsPerM1,
  };
}
