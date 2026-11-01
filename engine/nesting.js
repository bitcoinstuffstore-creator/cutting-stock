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

// Losse stukken blijven los; stukken met een baan worden per doek samengevoegd (volgorde van baan i).
function maakEenheden(stukken, s) {
  const eenheden = [];
  const perDoek = new Map();
  for (const st of stukken) {
    if (!st.baan) {
      eenheden.push({ id: st.id, w: st.w, h: st.h, magDraaien: !!st.magDraaien && !st.vastGedraaid, leden: [st] });
      continue;
    }
    if (!perDoek.has(st.doekId)) {
      const e = { id: st.id, w: 0, h: 0, magDraaien: false, leden: [] };
      perDoek.set(st.doekId, e);
      eenheden.push(e);
    }
    perDoek.get(st.doekId).leden.push(st);
  }
  for (const e of perDoek.values()) {
    e.leden.sort((a, b) => a.baan.i - b.baan.i);
    e.id = e.leden[0].id;
    e.w = Math.max(...e.leden.map((x) => x.w));
    e.h = e.leden.reduce((t, x) => t + x.h, 0) + (e.leden.length - 1) * s;
  }
  return eenheden;
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
    maakBak(v.id, v.soort === 'reststuk' ? 'reststuk' : 'rol', v.voorraadId ?? v.id, v.breedte, v.lengte, packerSoort));

  const volgorde = [...maakEenheden(stukken, s)].sort((a, b) => sleutel(b) - sleutel(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const onplaatsbaar = [];
  let nieuweRollen = 0;

  // Een eenheid is één los stuk of alle banen van één doek als één blok (w x n.h + speling ertussen),
  // ongedraaid geplaatst en daarna uitgevouwen tot n plaatsingen onder elkaar.
  const probeer = (b, e) => {
    const r = b.packer.plaats(e.w + s, e.h + s, e.magDraaien);
    if (!r) return false;
    e.leden.forEach((st, k) => b.bak.plaatsingen.push({
      stukId: st.id, doekId: st.doekId,
      x: r.x, y: r.y + k * (st.h + s),
      w: r.gedraaid ? st.h : st.w, h: r.gedraaid ? st.w : st.h,
      gedraaid: r.gedraaid, vastGedraaid: !!st.vastGedraaid,
    }));
    return true;
  };

  for (const e of volgorde) {
    if (bakken.some((b) => probeer(b, e))) continue;
    const nieuw = maakBak(`nieuw-${nieuweRollen + 1}`, 'nieuw', null, stof.rolbreedte, stof.rollengte * 100, packerSoort);
    if (probeer(nieuw, e)) {
      nieuweRollen++;
      bakken.push(nieuw);
    } else {
      onplaatsbaar.push(...e.leden);
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
