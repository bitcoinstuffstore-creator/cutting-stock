// Resultaat: inkoopadvies, verbruik per doek, normen en snijplannen (met werkbon).
import { getal, euro, esc, tabel } from './format.js';
import { exportPaneelHTML, kopieer } from './export-paneel.js';
import { snijplanSVG, orderNrVan, baanVan, veiligId } from './snijplan-svg.js';
import { doekRijen, inkoopCSV, doekenCSV, verschilSoort } from './resultaat-rijen.js';

const SUBTABS = [
  ['inkoop', 'Inkoopadvies'],
  ['doeken', 'Verbruik per doek'],
  ['normen', 'Normen'],
  ['snijplannen', 'Snijplannen'],
];
const SOORT = { reststuk: 'Reststuk', rol: 'Voorraadrol', nieuw: 'Nieuwe rol' };
const PACKER = { guillotine: 'Guillotine', maxrects: 'MaxRects' };
const SORTERING = { oppervlak: 'grootste oppervlak eerst', langsteZijde: 'langste zijde eerst', lengte: 'langste stuk eerst', breedte: 'breedste stuk eerst' };
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const KLASSE = { '<150': 'tot 150 cm', '150-249': '150–249 cm', '250-349': '250–349 cm', '>=350': '350 cm en breder' };
const KLEUREN = 8;

// UI-toestand die niet in het scenario hoort (blijft staan over een herberekening heen).
const ui = { export: null, filterStof: '', filterProduct: '', stof: null, werkbon: false };

const maat = (b, h) => `${getal(b, b % 1 ? 1 : 0)} × ${getal(h, h % 1 ? 1 : 0)}`;
const pct = (v) => `${getal(v, 1)}%`;

function strategieTekst(naam) {
  const [p, s] = String(naam || '').split('/');
  return p ? `${PACKER[p] ?? p}, ${SORTERING[s] ?? s}` : '–';
}

function leeg(tekst) {
  return `<div class="paneel leeg-staat">${esc(tekst)}</div>`;
}

export function renderResultaat(el, state, acties) {
  const sc = state.scenario;
  if (!sc.openOrders.length) {
    el.innerHTML = leeg('Nog geen open orders — laad de voorbeelddata of importeer een CSV.');
    return;
  }
  if (!state.resultaat) {
    el.innerHTML = leeg(state.fout ? `De berekening is mislukt: ${state.fout}` : 'Bezig met rekenen…');
    return;
  }
  const sub = SUBTABS.some(([k]) => k === state.subtab) ? state.subtab : 'inkoop';
  const r = state.resultaat;
  const inhoud = sub === 'doeken' ? doekenScherm(r, sc)
    : sub === 'normen' ? normenScherm(r, sc)
      : sub === 'snijplannen' ? snijplannenScherm(r, sc)
        : inkoopScherm(r, sc);

  el.innerHTML = `<div class="scherm-kop geen-print">
      <div class="schakel subtabs" role="group" aria-label="Onderdeel van het resultaat">
        ${SUBTABS.map(([k, t]) => `<button type="button" id="subtab-${k}" data-subtab="${k}" aria-pressed="${k === sub}">${t}</button>`).join('')}
      </div>
      ${state.fout ? `<p class="fout-tekst">Laatste berekening mislukt: ${esc(state.fout)}. Je ziet het vorige resultaat.</p>` : ''}
    </div>
    ${inhoud}`;

  const opnieuw = () => acties.zet('subtab', sub);
  el.onclick = (e) => {
    const knop = e.target.closest('button');
    if (!knop) return;
    if (knop.dataset.subtab) {
      ui.export = null;
      return acties.zet('subtab', knop.dataset.subtab);
    }
    if (knop.dataset.kopieer) return void kopieer(knop);
    if (knop.id === 'btn-export-inkoop-csv' || knop.id === 'btn-export-doeken-csv') {
      const soort = knop.id === 'btn-export-inkoop-csv' ? 'inkoop' : 'doeken';
      ui.export = ui.export === soort ? null : soort;
      opnieuw();
      if (ui.export) document.getElementById(`export-${soort}`)?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (knop.dataset.sluitPaneel) {
      const opener = ui.export === 'doeken' ? 'btn-export-doeken-csv' : 'btn-export-inkoop-csv';
      ui.export = null;
      opnieuw();
      return void document.getElementById(opener)?.focus();
    }
    if (knop.id === 'btn-werkbon') {
      ui.werkbon = !ui.werkbon;
      return opnieuw();
    }
  };
  el.onchange = (e) => {
    const t = e.target;
    if (t.id === 'filter-doeken-stof') ui.filterStof = t.value;
    else if (t.id === 'filter-doeken-product') ui.filterProduct = t.value;
    else if (t.id === 'snijplan-stof') ui.stof = t.value;
    else return;
    if (t.id !== 'snijplan-stof') ui.export = null;
    opnieuw();
  };
}

// ---------- Inkoopadvies ----------
function gevoelTag(inkoop, sc) {
  return inkoop.gevoelBron === 'eigen'
    ? '<span class="merk-tag" title="Je eigen inschatting (Stoffen &amp; regels)">eigen</span>'
    : `<span class="merk-tag" title="Netto doek plus de toeslag van de vuistregel">+${esc(getal(sc.instellingen.gevoelToeslag, 0))}%</span>`;
}

function verschilCel(eur) {
  const v = verschilSoort(eur);
  const uitleg = { 'te-veel': 'De vuistregel koopt meer dan het snijplan nodig heeft: dit bedrag bespaar je.', 'te-weinig': 'De vuistregel koopt minder dan het snijplan nodig heeft: dit bedrag aan stof kom je tekort.', gelijk: 'De vuistregel komt overeen met het snijplan.' }[v.soort];
  return `<td class="waarde verschil" data-soort="${v.soort}" title="${uitleg}">${euro(Math.abs(eur))} <span class="verschil-tag">${v.tekst}</span></td>`;
}

function vergelijkBalk(berekend, gevoel) {
  const max = Math.max(berekend, gevoel, 1e-9);
  const tekst = `Vuistregel ${getal(gevoel)} m¹, berekend ${getal(berekend)} m¹`;
  return `<td class="tekst"><div class="vergelijk" role="img" aria-label="${esc(tekst)}" title="${esc(tekst)}">
      <span class="balk balk-berekend" style="width:${((berekend / max) * 100).toFixed(1)}%"></span>
      <span class="balk balk-gevoel" style="width:${((gevoel / max) * 100).toFixed(1)}%"></span>
    </div></td>`;
}

function inkoopScherm(r, sc) {
  const regels = Object.values(r.perStof);
  const h = Number(sc.instellingen.horizonMaanden) || 0;
  const rijen = regels.map(({ stof, inkoop: i }) => `<tr>
      <td class="tekst">${esc(stof.naam)} <span class="bron-tag">${esc(stof.code)}</span></td>
      <td class="waarde">${getal(i.hardBrutoM1)}</td>
      <td class="waarde">${getal(i.verwachtM1)}</td>
      <td class="waarde">${getal(i.restVoorraadM1)}</td>
      <td class="waarde">${getal(i.teBestellenRollen, 0)}</td>
      <td class="waarde">${getal(i.teBestellenM1)}</td>
      <td class="waarde">${euro(i.kosten)}</td>
      <td class="waarde">${getal(i.gevoelM1)} ${gevoelTag(i, sc)}</td>
      ${verschilCel(i.verschilEuro)}
      ${vergelijkBalk(i.hardBrutoM1, i.gevoelM1)}
    </tr>`);
  const som = (f) => regels.reduce((s, x) => s + f(x.inkoop), 0);
  const voet = `<tr><td class="tekst">Totaal</td>
      <td class="waarde">${getal(som((i) => i.hardBrutoM1))}</td>
      <td class="waarde">${getal(som((i) => i.verwachtM1))}</td>
      <td class="waarde">${getal(som((i) => i.restVoorraadM1))}</td>
      <td class="waarde">${getal(som((i) => i.teBestellenRollen), 0)}</td>
      <td class="waarde">${getal(som((i) => i.teBestellenM1))}</td>
      <td class="waarde">${euro(r.totalen.kosten)}</td>
      <td class="waarde">${getal(som((i) => i.gevoelM1))}</td>
      ${verschilCel(r.totalen.verschilEuro)}
      <td></td></tr>`;
  const koppen = ['Stof', ['Harde behoefte m¹', 'num'], ['Verwacht m¹', 'num'], ['Voorraad over m¹', 'num'],
    ['Te bestellen rollen', 'num'], ['Te bestellen m¹', 'num'], ['Kosten', 'num'], ['Vuistregel m¹', 'num'],
    ['Verschil vuistregel', 'num'], 'Vuistregel ↔ berekend'];

  return `<section class="paneel" aria-labelledby="titel-inkoop">
      <div class="paneel-kop">
        <h2 id="titel-inkoop">Inkoopadvies</h2>
        <button type="button" class="knop knop-klein geen-print" id="btn-export-inkoop-csv" aria-expanded="${ui.export === 'inkoop'}">Exporteren als CSV</button>
      </div>
      <p class="uitleg">Zoveel stof bestel je ${h === 0 ? 'voor de open orders' : `voor de open orders en ${h} ${h === 1 ? 'maand' : 'maanden'} verwacht verbruik`}.
        De harde behoefte komt uit het snijplan; het verwachte verbruik uit je historie. Wat er na het snijden op je voorraadrollen overblijft, gaat eerst van het verwachte verbruik af.</p>
      ${ui.export === 'inkoop' ? exportPaneelHTML({ id: 'export-inkoop', titel: 'Inkoopadvies als CSV', uitleg: 'Puntkomma-gescheiden, met komma als decimaalteken. Plak het in Excel of sla het op als inkoopadvies.csv.', tekst: inkoopCSV(r) }) : ''}
      <p class="legenda" aria-hidden="true"><span class="legenda-item"><span class="staal staal-berekend"></span>berekend uit het snijplan</span>
        <span class="legenda-item"><span class="staal staal-gevoel"></span>vuistregel (netto doek + toeslag, of je eigen inschatting)</span></p>
      ${tabel({ id: 'tabel-inkoop', koppen, rijen, voet })}
    </section>
    ${waarschuwingenPaneel(r)}`;
}

function waarschuwingenPaneel(r) {
  if (!r.waarschuwingen.length) return '';
  const open = r.waarschuwingen.filter((w) => w.bron === 'open').length;
  const items = r.waarschuwingen.map((w) => `<li class="waarschuwing"><span class="bron">${w.bron === 'historie' ? 'historie' : 'open'}</span>${esc(w.melding)}</li>`).join('');
  return `<details class="meldingen" id="resultaat-meldingen"${open ? ' open' : ''}>
      <summary>${getal(r.waarschuwingen.length, 0)} ${r.waarschuwingen.length === 1 ? 'melding' : 'meldingen'}: deze regels tellen niet (volledig) mee</summary>
      <ul class="foutlijst">${items}</ul>
    </details>`;
}

// ---------- Verbruik per doek ----------
function doekenScherm(r, sc) {
  const alle = doekRijen(r, sc);
  const stoffen = sc.stoffen.filter((s) => alle.some((d) => d.stof === s.code));
  const producten = sc.producttypes.filter((p) => alle.some((d) => d.product === p.code));
  if (!stoffen.some((s) => s.code === ui.filterStof)) ui.filterStof = '';
  if (!producten.some((p) => p.code === ui.filterProduct)) ui.filterProduct = '';
  const rijenData = alle.filter((d) => (!ui.filterStof || d.stof === ui.filterStof) && (!ui.filterProduct || d.product === ui.filterProduct));
  const stofNaam = new Map(sc.stoffen.map((s) => [s.code, s.naam]));

  const optie = (w, t, gekozen) => `<option value="${esc(w)}"${w === gekozen ? ' selected' : ''}>${esc(t)}</option>`;
  const filters = `<div class="filters">
      <div class="veld"><label for="filter-doeken-stof">Stof</label>
        <div class="invoer-eenheid"><select id="filter-doeken-stof">${optie('', 'Alle stoffen', ui.filterStof)}${stoffen.map((s) => optie(s.code, s.naam, ui.filterStof)).join('')}</select></div></div>
      <div class="veld"><label for="filter-doeken-product">Product</label>
        <div class="invoer-eenheid"><select id="filter-doeken-product">${optie('', 'Alle producten', ui.filterProduct)}${producten.map((p) => optie(p.code, p.naam, ui.filterProduct)).join('')}</select></div></div>
    </div>`;

  const rijen = rijenData.map((d) => `<tr>
      <td class="tekst">${esc(d.orderNr)}</td>
      <td class="tekst">${esc(d.productNaam)}</td>
      <td class="tekst" title="${esc(stofNaam.get(d.stof) ?? '')}">${esc(d.stof)}</td>
      <td class="waarde">${d.ordermaat ? maat(d.ordermaat.b, d.ordermaat.h) : '–'}</td>
      <td class="waarde">${d.snijmaat ? maat(d.snijmaat.b, d.snijmaat.h) : '–'}</td>
      <td class="waarde">${getal(d.nettoM2)}</td>
      <td class="waarde">${getal(d.brutoM2)}</td>
      <td class="waarde">${getal(d.m1)}</td>
    </tr>`);
  const som = (f) => rijenData.reduce((s, d) => s + f(d), 0);
  const voet = rijenData.length ? `<tr><td class="tekst" colspan="5">Totaal ${getal(rijenData.length, 0)} doeken</td>
      <td class="waarde">${getal(som((d) => d.nettoM2))}</td><td class="waarde">${getal(som((d) => d.brutoM2))}</td><td class="waarde">${getal(som((d) => d.m1))}</td></tr>` : '';

  return `<section class="paneel" aria-labelledby="titel-doeken">
      <div class="paneel-kop">
        <h2 id="titel-doeken">Verbruik per doek <span class="tel">${getal(rijenData.length, 0)} van ${getal(alle.length, 0)}</span></h2>
        <button type="button" class="knop knop-klein geen-print" id="btn-export-doeken-csv" aria-expanded="${ui.export === 'doeken'}">Exporteren als CSV</button>
      </div>
      <p class="uitleg">Elke doek krijgt zijn deel van de bruto stof, naar verhouding van zijn netto oppervlak. Zo zie je wat een doek echt kost aan stof, inclusief snijverlies. Snijmaat = ordermaat + confectietoeslag.</p>
      ${filters}
      ${ui.export === 'doeken' ? exportPaneelHTML({ id: 'export-doeken', titel: 'Verbruik per doek als CSV', uitleg: 'De doeken die nu in de filter staan. Puntkomma-gescheiden; sla het op als verbruik-per-doek.csv.', tekst: doekenCSV(rijenData) }) : ''}
      ${rijenData.length
        ? tabel({ id: 'tabel-doeken', koppen: ['Order', 'Product', 'Stof', ['Ordermaat cm', 'num'], ['Snijmaat cm', 'num'], ['Netto m²', 'num'], ['Bruto m²', 'num'], ['m¹', 'num']], rijen, voet })
        : '<div class="leeg-staat">Geen doeken voor deze filter.</div>'}
    </section>`;
}

// ---------- Normen ----------
function niceMax(v) {
  if (!(v > 0)) return 1;
  const macht = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((f) => f * macht).find((m) => m >= v - 1e-9);
}

function maandGrafiek(code, reeks) {
  const W = 360;
  const Hh = 180;
  const m = { l: 40, r: 6, t: 22, b: 22 };
  const pw = W - m.l - m.r;
  const ph = Hh - m.t - m.b;
  const max = niceMax(Math.max(...reeks.map((x) => x.brutoM1)));
  const stap = pw / reeks.length;
  const bw = stap * 0.68;
  const y = (v) => m.t + ph - (v / max) * ph;
  const r1 = (v) => Math.round(v * 10) / 10;
  const staven = reeks.map((x, i) => {
    const bx = m.l + i * stap + (stap - bw) / 2;
    const [jaar, mnd] = x.maand.split('-');
    const naam = `${MAANDEN[Number(mnd) - 1] ?? mnd} ${jaar}`;
    return `<g><title>${esc(naam)}: ${esc(getal(x.brutoM1))} m¹</title>
      <rect class="staaf-raak" x="${r1(m.l + i * stap)}" y="${m.t}" width="${r1(stap)}" height="${ph}"/>
      <rect class="staaf" x="${r1(bx)}" y="${r1(y(x.brutoM1))}" width="${r1(bw)}" height="${r1(Math.max(0, m.t + ph - y(x.brutoM1)))}"/>
      <text class="as-label" x="${r1(bx + bw / 2)}" y="${Hh - 7}" text-anchor="middle">${esc(MAANDEN[Number(mnd) - 1] ?? mnd)}</text></g>`;
  }).join('');
  return `<svg class="grafiek" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Maandverbruik ${esc(code)} in m¹, hoogste maand ${esc(getal(Math.max(...reeks.map((x) => x.brutoM1))))} m¹" xmlns="http://www.w3.org/2000/svg">
      <line class="as-lijn hulplijn" x1="${m.l}" x2="${W - m.r}" y1="${m.t}" y2="${m.t}"/>
      <line class="as-lijn hulplijn" x1="${m.l}" x2="${W - m.r}" y1="${r1(m.t + ph / 2)}" y2="${r1(m.t + ph / 2)}"/>
      <text class="as-label" x="${m.l - 5}" y="${m.t + 3.5}" text-anchor="end">${esc(getal(max, max % 1 ? 1 : 0))}</text>
      <text class="as-label" x="${m.l - 5}" y="${r1(m.t + ph / 2 + 3.5)}" text-anchor="end">${esc(getal(max / 2, (max / 2) % 1 ? 1 : 0))}</text>
      <text class="as-label" x="${m.l - 5}" y="${m.t + ph + 3.5}" text-anchor="end">0</text>
      <text class="as-label as-eenheid" x="${m.l - 5}" y="10" text-anchor="end">m¹</text>
      ${staven}
      <line class="as-lijn" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ph}" y2="${m.t + ph}"/>
    </svg>`;
}

function normenScherm(r, sc) {
  const productNaam = new Map(sc.producttypes.map((p) => [p.code, p.naam]));
  const groepen = sc.stoffen.map((s) => ({ stof: s, normen: r.normen.filter((n) => n.stof === s.code) })).filter((g) => g.normen.length);
  const koppen = ['Product', 'Breedteklasse', ['Doeken', 'num'], ['Gem. netto m²', 'num'], ['Gem. m¹', 'num'], ['Verliesfactor', 'num']];
  const rijen = groepen.flatMap(({ stof, normen }) => [
    `<tr class="groep"><th scope="rowgroup" colspan="6">${esc(stof.naam)} <span class="bron-tag">${esc(stof.code)}</span></th></tr>`,
    ...normen.map((n) => `<tr>
      <td class="tekst">${esc(productNaam.get(n.product) ?? n.product)}</td>
      <td class="tekst">${esc(KLASSE[n.maatklasse] ?? n.maatklasse)}</td>
      <td class="waarde">${getal(n.aantalDoeken, 0)}</td>
      <td class="waarde">${getal(n.gemNettoM2)}</td>
      <td class="waarde">${getal(n.gemM1)}</td>
      <td class="waarde">${getal(n.verliesfactor)}</td>
    </tr>`),
  ]);
  const grafieken = sc.stoffen.map((s) => {
    const reeks = r.maandverbruik[s.code] || [];
    return `<figure class="grafiek-kaart">
        <figcaption><b>${esc(s.naam)}</b> <span class="bron-tag">${esc(s.code)}</span></figcaption>
        ${reeks.length ? maandGrafiek(s.code, reeks) : '<div class="leeg-staat">Geen historie voor deze stof.</div>'}
      </figure>`;
  }).join('');

  return `<section class="paneel" aria-labelledby="titel-normen">
      <div class="paneel-kop"><h2 id="titel-normen">Verbruiksnormen</h2></div>
      <p class="uitleg">Gemiddeld stofverbruik per doek uit je historie, per stof, product en breedteklasse. De verliesfactor is bruto stof gedeeld door netto doek.</p>
      ${groepen.length ? tabel({ id: 'tabel-normen', koppen, rijen, klasse: 'normen' }) : '<div class="leeg-staat">Nog geen historie — importeer je orders van vorig jaar bij Orders → Historie.</div>'}
    </section>
    <section class="paneel" aria-labelledby="titel-maandverbruik">
      <div class="paneel-kop"><h2 id="titel-maandverbruik">Maandverbruik per stof</h2><span class="tel">bruto m¹ per maand, uit de historie</span></div>
      <div class="grafieken">${grafieken}</div>
    </section>`;
}

// ---------- Snijplannen + werkbon ----------
function snijplannenScherm(r, sc) {
  const metPlan = Object.values(r.perStof).filter((p) => p.snijplan.bakken.some((b) => b.plaatsingen.length));
  if (!metPlan.length) return leeg('Er is nog geen snijplan: geen enkele open order kon op een rol worden geplaatst. Bekijk de meldingen bij Inkoopadvies.');
  if (!metPlan.some((p) => p.stof.code === ui.stof)) ui.stof = metPlan[0].stof.code;
  const p = r.perStof[ui.stof];
  const { stof, snijplan, verbruik } = p;
  const bakken = snijplan.bakken.filter((b) => b.plaatsingen.length);
  const perBak = new Map(verbruik.perBak.map((x) => [x.bakId, x]));

  // Kleur per doek: vaste volgorde van de doeken van deze stof.
  // Aantal stukken (banen) per doek over alle bakken van deze stof.
  const delen = new Map();
  for (const b of bakken) for (const pl of b.plaatsingen) delen.set(pl.doekId, (delen.get(pl.doekId) || 0) + 1);
  const delenVoor = (id) => delen.get(id) || 1;
  const doekIndex = new Map();
  for (const d of r.doeken) if (d.stof === stof.code && !doekIndex.has(d.doekId)) doekIndex.set(d.doekId, doekIndex.size);
  for (const b of bakken) for (const pl of b.plaatsingen) if (!doekIndex.has(pl.doekId)) doekIndex.set(pl.doekId, doekIndex.size);
  const kleurVoor = (id) => `kleur-${doekIndex.get(id) % KLEUREN}`;

  const keuze = `<div class="veld veld-stof"><label for="snijplan-stof">Stof</label>
      <div class="invoer-eenheid"><select id="snijplan-stof">${metPlan.map((x) => `<option value="${esc(x.stof.code)}"${x.stof.code === ui.stof ? ' selected' : ''}>${esc(x.stof.naam)}</option>`).join('')}</select></div></div>`;
  const t = verbruik.totaal;
  const samenvatting = `<dl class="kerngetallen">
      <div><dt>Rolbreedte</dt><dd>${getal(stof.rolbreedte, 0)} cm</dd></div>
      <div><dt>Bakken</dt><dd>${getal(bakken.length, 0)}</dd></div>
      <div><dt>Nieuwe rollen</dt><dd>${getal(snijplan.nieuweRollen, 0)}</dd></div>
      <div><dt>Bruto</dt><dd>${getal(t.brutoM1)} m¹</dd></div>
      <div><dt>Snijverlies</dt><dd>${pct((t.verliesfactor - 1) * 100)}</dd></div>
      <div><dt>Strategie</dt><dd class="tekst">${esc(strategieTekst(snijplan.strategie))}</dd></div>
    </dl>`;
  const onplaatsbaar = snijplan.onplaatsbaar.length
    ? `<ul class="foutlijst">${snijplan.onplaatsbaar.map((s) => `<li>Order ${esc(s.orderNr)}: stuk ${esc(maat(s.w, s.h))} cm past niet op deze stof.</li>`).join('')}</ul>`
    : '';

  const kop = `<section class="paneel" aria-labelledby="titel-snijplannen">
      <div class="paneel-kop">
        <h2 id="titel-snijplannen">${ui.werkbon ? 'Werkbon' : 'Snijplannen'} · ${esc(stof.naam)}</h2>
        <button type="button" class="knop knop-klein geen-print" id="btn-werkbon" aria-pressed="${ui.werkbon}">${ui.werkbon ? 'Terug naar snijplannen' : 'Werkbon tonen'}</button>
      </div>
      <div class="snijplan-balk geen-print">${keuze}</div>
      ${samenvatting}
      ${onplaatsbaar}
      ${ui.werkbon
        ? '<p class="uitleg geen-print">De werkbon voor de snijtafel: per rol het plan met genummerde stukken en de lijst om af te vinken. Open de demo lokaal in je browser om hem te printen.</p>'
        : '<p class="uitleg">Elke rol van boven (begin van de rol) naar beneden. Gekleurde vlakken zijn doeken, het gearceerde deel is snijverlies. Wijs een stuk aan voor de details.</p>'}
    </section>`;

  return kop + (ui.werkbon ? werkbon(stof, bakken, perBak, r, sc, delenVoor) : `<div class="bakken">${bakken.map((b) => bakKaart(b, stof, perBak.get(b.id), kleurVoor, delenVoor)).join('')}</div>`);
}

function bakKop(b, info) {
  const verlies = info && info.brutoM2 > 0 ? (info.verliesM2 / info.brutoM2) * 100 : 0;
  return `<div class="bak-kop">
      <h3><span class="soort-tag" data-soort="${esc(b.soort)}">${SOORT[b.soort] ?? esc(b.soort)}</span> ${esc(b.id)}</h3>
      <p class="bak-meta"><span>${maat(b.breedte, b.lengte)} cm</span><span>gebruikt ${getal((info?.brutoLengte ?? b.gebruikteLengte) / 100)} m¹</span><span>verlies ${pct(verlies)}</span>${info?.restIsVerlies ? `<span>rest ${getal(info.restLengte, 0)} cm telt als verlies</span>` : ''}</p>
    </div>`;
}

function bakKaart(b, stof, info, kleurVoor, delenVoor) {
  const svg = snijplanSVG(b, {
    kleurVoor,
    verliesLengte: info?.restIsVerlies ? info.restLengte : 0,
    refBreedte: stof.rolbreedte,
    delenVoor,
    titel: (p, baan) => `${orderNrVan(p.doekId)}${baan ? ` · baan ${baan.i}/${baan.n}` : ''} · ${maat(p.w, p.h)} cm${p.gedraaid ? ' · gedraaid' : ''} · op ${getal(p.x, 0)}, ${getal(p.y, 0)} cm`,
  });
  const breedte = Math.min(100, (b.breedte / stof.rolbreedte) * 100);
  return `<article class="bak-kaart">
      ${bakKop(b, info)}
      <div class="snijplan-kader" id="kader-${veiligId(`${stof.code}-${b.id}`)}" data-scroll-kader tabindex="0" role="region" aria-label="Snijplan ${esc(b.id)}, scrollbaar"><div style="width:${breedte.toFixed(1)}%">${svg}</div></div>
    </article>`;
}

function werkbon(stof, bakken, perBak, r, sc, delenVoor) {
  const rijen = doekRijen(r, sc);
  const doekInfo = new Map(rijen.map((d) => [d.doekId, d]));
  let nr = 0;
  const rollen = bakken.map((b) => {
    const info = perBak.get(b.id);
    const volgorde = [...b.plaatsingen].sort((a, c) => a.y - c.y || a.x - c.x);
    const nummer = new Map(volgorde.map((p) => [p.stukId, ++nr]));
    const H = b.gebruikteLengte + (info?.restIsVerlies ? info.restLengte : 0);
    const svg = snijplanSVG(b, {
      kleurVoor: () => 'wb',
      compact: true,
      id: 'werkbon',
      refBreedte: stof.rolbreedte,
      delenVoor,
      verliesLengte: info?.restIsVerlies ? info.restLengte : 0,
      label: (p) => String(nummer.get(p.stukId)),
      titel: (p, baan) => `${nummer.get(p.stukId)}. ${orderNrVan(p.doekId)}${baan ? ` · baan ${baan.i}/${baan.n}` : ''} · ${maat(p.w, p.h)} cm`,
    });
    const regels = volgorde.map((p) => {
      const d = doekInfo.get(p.doekId);
      const baan = baanVan(p, delenVoor(p.doekId));
      const opm = [p.gedraaid ? 'gedraaid' : '', baan ? `baan ${baan.i} van ${baan.n}` : ''].filter(Boolean).join(', ');
      return `<tr>
          <td class="waarde">${nummer.get(p.stukId)}</td>
          <td class="tekst">${esc(orderNrVan(p.doekId))}</td>
          <td class="tekst">${esc(d?.productNaam ?? '')}</td>
          <td class="waarde">${maat(p.w, p.h)}</td>
          <td class="waarde">${getal(p.x, 0)} / ${getal(p.y, 0)}</td>
          <td class="tekst">${opm}</td>
          <td class="vink-vak" aria-hidden="true"></td>
        </tr>`;
    });
    return `<article class="werkbon-rol">
        ${bakKop(b, info)}
        <div class="werkbon-inhoud">
          <div class="snijplan-kader werkbon-plan" id="werkbon-kader-${veiligId(b.id)}" data-scroll-kader tabindex="0" role="region" aria-label="Werkbonplan ${esc(b.id)}, scrollbaar" style="--l:${Math.round(H)}"><div style="width:${Math.min(100, (b.breedte / stof.rolbreedte) * 100).toFixed(1)}%">${svg}</div></div>
          ${tabel({ id: `werkbon-${veiligId(b.id)}`, klasse: 'werkbon-tabel', koppen: [['Nr', 'num'], 'Order', 'Product', ['Stuk b × l cm', 'num'], ['x / y cm', 'num'], 'Let op', ['✓', 'vink']], rijen: regels })}
        </div>
      </article>`;
  }).join('');
  return `<div class="werkbon" id="werkbon">
      <p class="werkbon-titel">Werkbon ${esc(stof.naam)} <span class="bron-tag">${esc(stof.code)}</span> · rolbreedte ${getal(stof.rolbreedte, 0)} cm · ${getal(nr, 0)} stukken op ${getal(bakken.length, 0)} ${bakken.length === 1 ? 'rol' : 'rollen'}</p>
      ${rollen}
    </div>`;
}

// Bij het verlaten van het Resultaat-scherm: een open exportpaneel vervalt.
export function verlaatResultaat() {
  ui.export = null;
}
