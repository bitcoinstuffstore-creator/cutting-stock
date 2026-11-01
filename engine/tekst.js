// Getallen in meldingen: Nederlandse notatie, komma als decimaalteken, hoogstens 1 decimaal.
export function nl(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  const r = Math.round(v * 10) / 10;
  return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
}
