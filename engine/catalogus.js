// Tolerante opzoekfuncties: eerst op code, dan op naam (getrimd, hoofdletterongevoelig).
const norm = (s) => String(s ?? '').trim().toLowerCase();

function zoek(lijst, ref) {
  const r = norm(ref);
  if (!r || !Array.isArray(lijst)) return null;
  return lijst.find((x) => norm(x.code) === r) ?? lijst.find((x) => norm(x.naam) === r) ?? null;
}

export const zoekStof = (stoffen, ref) => zoek(stoffen, ref);
export const zoekProduct = (producttypes, ref) => zoek(producttypes, ref);
