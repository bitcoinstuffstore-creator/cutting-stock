// Multi-bin nesting per stof: 2 packers x 4 sorteervolgordes, beste run wint.
import { maakPacker } from './packers.js';

const SORTEERSLEUTELS = {
  oppervlak: (s) => s.w * s.h,
  lengte: (s) => s.h,
  breedte: (s) => s.w,
  langsteZijde: (s) => Math.max(s.w, s.h),
};
const PACKERS = ['guillotine', 'maxrects'];

export const STRATEGIEEN = PACKERS.flatMap((p) => Object.keys(SORTEERSLEUTELS).map((k) => `${p}/${k}`));

function maakBak(id, soort, voorraadId, breedte, lengte, packerSoort) {
  return {
    bak: { id, soort, voorraadId, breedte, lengte, plaatsingen: [], gebruikteLengte: 0 },
    packer: maakPacker(packerSoort, breedte, lengte),
  };
}

// Eén run met een vaste strategie. Begint altijd met verse packers.
export function nestMetStrategie(stukken, stof, voorraad, instellingen, naam) {
  const [packerSoort, sleutelNaam] = naam.split('/');
  const sleutel = SORTEERSLEUTELS[sleutelNaam];
  if (!sleutel || !PACKERS.includes(packerSoort)) throw new Error(`Onbekende strategie: ${naam}`);
  const s = instellingen?.snijspeling ?? 0;

  const reststukken = voorraad
    .filter((v) => v.soort === 'reststuk')
    .sort((a, b) => a.lengte - b.lengte || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rollen = voorraad.filter((v) => v.soort !== 'reststuk');
  const bakken = [...reststukken, ...rollen].map((v) =>
    maakBak(v.id, v.soort === 'reststuk' ? 'reststuk' : 'rol', v.id, v.breedte, v.lengte, packerSoort));

  const volgorde = [...stukken].sort((a, b) => sleutel(b) - sleutel(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const onplaatsbaar = [];
  let nieuweRollen = 0;

  const probeer = (b, st) => {
    const r = b.packer.plaats(st.w + s, st.h + s, st.magDraaien && !st.vastGedraaid);
    if (!r) return false;
    b.bak.plaatsingen.push({
      stukId: st.id, doekId: st.doekId, x: r.x, y: r.y,
      w: r.w - s, h: r.h - s, gedraaid: r.gedraaid,
    });
    return true;
  };

  for (const st of volgorde) {
    if (bakken.some((b) => probeer(b, st))) continue;
    const nieuw = maakBak(`nieuw-${nieuweRollen + 1}`, 'nieuw', null, stof.rolbreedte, stof.rollengte * 100, packerSoort);
    if (probeer(nieuw, st)) {
      nieuweRollen++;
      bakken.push(nieuw);
    } else {
      onplaatsbaar.push(st);
    }
  }

  const uit = bakken.map((b) => {
    b.bak.gebruikteLengte = b.bak.plaatsingen.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    return b.bak;
  });
  return { bakken: uit, strategie: naam, nieuweRollen, onplaatsbaar };
}

export function nestStof(stukken, stof, voorraad, instellingen) {
  const totaal = (r) => r.bakken.reduce((a, b) => a + b.gebruikteLengte, 0);
  let beste = null;
  let besteTotaal = Infinity;
  for (const naam of STRATEGIEEN) {
    const r = nestMetStrategie(stukken, stof, voorraad, instellingen, naam);
    const t = totaal(r);
    if (!beste || r.nieuweRollen < beste.nieuweRollen || (r.nieuweRollen === beste.nieuweRollen && t < besteTotaal)) {
      beste = r;
      besteTotaal = t;
    }
  }
  return beste;
}
