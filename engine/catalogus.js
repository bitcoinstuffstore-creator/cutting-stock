// Tolerante opzoekfuncties: eerst op code, dan op naam (getrimd, hoofdletterongevoelig).
const norm = (s) => String(s ?? '').trim().toLowerCase();

function zoek(lijst, ref) {
  const r = norm(ref);
  if (!r || !Array.isArray(lijst)) return null;
  return lijst.find((x) => norm(x.code) === r) ?? lijst.find((x) => norm(x.naam) === r) ?? null;
}

export const zoekStof = (stoffen, ref) => zoek(stoffen, ref);
export const zoekProduct = (producttypes, ref) => zoek(producttypes, ref);

// Draairegel van een stof: 'nooit' | 'alsTeBreed' | 'vrij'. Oude scenario's hebben draaienToegestaan (boolean).
export const DRAAIEN = ['nooit', 'alsTeBreed', 'vrij'];
export function draaienVan(stof) {
  if (DRAAIEN.includes(stof?.draaien)) return stof.draaien;
  return stof?.draaienToegestaan === true ? 'vrij' : 'nooit';
}

// Een stof waarmee te rekenen valt: rolbreedte en rollengte > 0 en eindig, prijs eindig.
export function geldigeStof(stof) {
  const pos = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const prijs = stof?.prijsPerM1 ?? 0;
  return !!stof && pos(stof.rolbreedte) && pos(stof.rollengte) && typeof prijs === 'number' && Number.isFinite(prijs);
}
