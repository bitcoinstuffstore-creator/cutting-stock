// Opmaak voor de demo: nl-NL getallen, HTML-escape, CSV. Zuiver: geen engine-imports.
const NBSP = /[  ]/g;
const formatters = new Map();

function fmt(dec) {
  if (!formatters.has(dec)) {
    formatters.set(dec, new Intl.NumberFormat('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  }
  return formatters.get(dec);
}

export function getal(n, dec = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  return fmt(dec).format(Number(n)).replace(NBSP, ' ');
}

export function euro(n) {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  const v = Number(n);
  return (v < 0 ? '-€ ' : '€ ') + getal(Math.abs(v), 2);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

function csvVeld(v) {
  if (v == null) return '';
  const t = typeof v === 'number' ? (Number.isFinite(v) ? String(v).replace('.', ',') : '') : String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

export function naarCSV(kolommen, rijen) {
  const kop = kolommen.map((k) => csvVeld(k.kop)).join(';');
  const body = rijen.map((r) => kolommen.map((k) => csvVeld(k.waarde(r))).join(';'));
  return [kop, ...body].join('\n');
}

// Een tabel-scrollkader met kop en rijen (rijen en voet zijn al HTML-strings).
export function tabel({ id = '', koppen, rijen, klasse = '', voet = '' }) {
  const th = koppen.map((k) => {
    const [tekst, cls] = Array.isArray(k) ? k : [k, ''];
    return `<th${cls ? ` class="${cls}"` : ''} scope="col">${esc(tekst)}</th>`;
  }).join('');
  return `<div class="tabel-scroll"><table${id ? ` id="${id}"` : ''} class="${klasse}"><thead><tr>${th}</tr></thead><tbody>${rijen.join('')}</tbody>${voet ? `<tfoot>${voet}</tfoot>` : ''}</table></div>`;
}

// Getal uit een invoerveld: komma of punt als decimaalteken, punt als duizendtal (1.250).
// Leeg → null, ongeldig → NaN.
export function leesGetal(tekst) {
  const t = String(tekst ?? '').replace(/\s/g, '');
  if (t === '') return null;
  let s = t;
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replaceAll('.', '').replace(',', '.');
  else s = s.replace(',', '.');
  return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// Getal voor in een invoerveld (zonder duizendtallen, komma als decimaalteken).
export function invoer(n) {
  if (n == null || (typeof n === 'number' && !Number.isFinite(n))) return '';
  return String(n).replace('.', ',');
}
