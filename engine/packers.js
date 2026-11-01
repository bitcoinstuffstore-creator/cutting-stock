// Single-bin packers. x across the roll width (0..breedte), y along the roll length (0..lengte).
// w/h passed to plaats already include speling; the packer is agnostic of it.
export const EPS = 1e-9;

function past(r, w, h) {
  return w <= r.w + EPS && h <= r.h + EPS;
}

// Compare score tuples lexicographically (EPS tolerance).
function beter(a, b) {
  if (!b) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i] - EPS) return true;
    if (a[i] > b[i] + EPS) return false;
  }
  return false;
}

function guillotine(breedte, lengte) {
  let vrij = [{ x: 0, y: 0, w: breedte, h: lengte }];

  function zoek(w, h) {
    let best = null;
    for (let i = 0; i < vrij.length; i++) {
      const r = vrij[i];
      if (!past(r, w, h)) continue;
      const score = [r.w * r.h - w * h, r.y, r.x];
      if (beter(score, best && best.score)) best = { i, score };
    }
    return best;
  }

  function zet(i, w, h) {
    const r = vrij[i];
    const rw = r.w - w;
    const rh = r.h - h;
    const nieuw = [];
    // Shorter-axis split: cut along the shorter leftover axis.
    if (rw < rh) {
      nieuw.push({ x: r.x + w, y: r.y, w: rw, h });
      nieuw.push({ x: r.x, y: r.y + h, w: r.w, h: rh });
    } else {
      nieuw.push({ x: r.x + w, y: r.y, w: rw, h: r.h });
      nieuw.push({ x: r.x, y: r.y + h, w, h: rh });
    }
    vrij.splice(i, 1, ...nieuw.filter((n) => n.w > EPS && n.h > EPS));
    return { x: r.x, y: r.y };
  }

  return { zoek, zet };
}

function maxrects(breedte, lengte) {
  let vrij = [{ x: 0, y: 0, w: breedte, h: lengte }];

  function zoek(w, h) {
    let best = null;
    for (let i = 0; i < vrij.length; i++) {
      const r = vrij[i];
      if (!past(r, w, h)) continue;
      const score = [r.y, r.x];
      if (beter(score, best && best.score)) best = { i, score };
    }
    return best;
  }

  function zet(i, w, h) {
    const { x, y } = vrij[i];
    const nieuw = [];
    for (const r of vrij) {
      const overlapt = x < r.x + r.w - EPS && x + w > r.x + EPS && y < r.y + r.h - EPS && y + h > r.y + EPS;
      if (!overlapt) { nieuw.push(r); continue; }
      if (x > r.x + EPS) nieuw.push({ x: r.x, y: r.y, w: x - r.x, h: r.h });
      if (x + w < r.x + r.w - EPS) nieuw.push({ x: x + w, y: r.y, w: r.x + r.w - (x + w), h: r.h });
      if (y > r.y + EPS) nieuw.push({ x: r.x, y: r.y, w: r.w, h: y - r.y });
      if (y + h < r.y + r.h - EPS) nieuw.push({ x: r.x, y: y + h, w: r.w, h: r.y + r.h - (y + h) });
    }
    // Prune rects contained in another (first of equal duplicates survives).
    vrij = nieuw.filter((a, ia) => !nieuw.some((b, ib) => {
      if (ia === ib) return false;
      const bevat = a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
      if (!bevat) return false;
      const gelijk = b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS;
      return !gelijk || ib < ia;
    }));
    return { x, y };
  }

  return { zoek, zet };
}

export function maakPacker(soort, breedte, lengte) {
  let kern;
  if (soort === 'guillotine') kern = guillotine(breedte, lengte);
  else if (soort === 'maxrects') kern = maxrects(breedte, lengte);
  else throw new Error(`Onbekende packer: ${soort}`);

  return {
    plaats(w, h, magDraaien) {
      const a = kern.zoek(w, h);
      const b = magDraaien ? kern.zoek(h, w) : null;
      let gedraaid = false;
      let keuze = a;
      // Rotated wins only when strictly better; ties keep the unrotated orientation.
      if (b && (!a || beter(b.score, a.score))) { keuze = b; gedraaid = true; }
      if (!keuze) return null;
      const pw = gedraaid ? h : w;
      const ph = gedraaid ? w : h;
      const { x, y } = kern.zet(keuze.i, pw, ph);
      return { x, y, w: pw, h: ph, gedraaid };
    },
  };
}
