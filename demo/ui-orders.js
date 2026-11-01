// Orders-scherm: open orders en historie bewerken, CSV-import, voorbeelddata en leegmaken.
import { parseOrdersCSV } from './engine/index.js';
import { esc, getal, invoer, leesGetal, tabel } from './format.js';

const LIJSTEN = {
  open: { sleutel: 'openOrders', naam: 'Open orders', tabelId: 'tabel-open' },
  historie: { sleutel: 'historie', naam: 'Historie', tabelId: 'tabel-historie' },
};
const BRON_LABEL = { open: 'Open orders', historie: 'Historie', stoffen: 'Stoffen' };
const STAP = { open: 200, historie: 100 };
const KOLOMMEN = [
  { veld: 'orderNr', kop: 'Ordernr', soort: 'tekst', breedte: 'w-m' },
  { veld: 'datum', kop: 'Datum', soort: 'tekst', breedte: 'w-m', placeholder: 'JJJJ-MM-DD' },
  { veld: 'product', kop: 'Product', soort: 'tekst', breedte: 'w-m', lijst: 'lijst-producten' },
  { veld: 'stof', kop: 'Stof', soort: 'tekst', breedte: 'w-s', lijst: 'lijst-stoffen' },
  { veld: 'breedte', kop: 'Breedte cm', soort: 'getal', breedte: 'w-s' },
  { veld: 'hoogte', kop: 'Hoogte cm', soort: 'getal', breedte: 'w-s' },
  { veld: 'aantal', kop: 'Aantal', soort: 'geheel', breedte: 'w-xs' },
];
const VOORBEELD_CSV = 'ordernr;datum;product;stof;breedte;hoogte;aantal\nA-1001;2026-11-05;screen;S5A;245;180;1\nA-1002;2026-11-05;knikarm;ZSB;450;250;1';

// Schermtoestand die niet in het scenario hoort.
const ui = {
  importTekst: '',
  importMelding: '',
  importLijst: 'open',
  bevestigLeeg: false,
  meldingenOpen: false,
  zichtbaar: { open: STAP.open, historie: STAP.historie },
};

function vandaag() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function celHTML(lijst, i, kol, regel) {
  const id = `${lijst}-${i}-${kol.veld}`;
  const v = regel[kol.veld];
  const num = kol.soort !== 'tekst';
  const waarde = num ? invoer(v) : String(v ?? '');
  const ongeldig = num && !(Number(v) > 0);
  return `<td><input class="cel ${kol.breedte}${num ? ' num' : ''}" id="${id}" data-i="${i}" data-veld="${kol.veld}"
    value="${esc(waarde)}"${num ? ' inputmode="decimal"' : ''}${kol.lijst ? ` list="${kol.lijst}"` : ''}
    ${kol.placeholder ? `placeholder="${kol.placeholder}"` : ''}${ongeldig ? ' aria-invalid="true"' : ''}
    autocomplete="off" spellcheck="false" aria-label="${esc(kol.kop)}, regel ${i + 1}"></td>`;
}

function tabelHTML(state, lijst) {
  const { sleutel, tabelId } = LIJSTEN[lijst];
  const regels = state.scenario[sleutel];
  // Per regel (regelIndex), niet per ordernummer: andere regels van dezelfde order blijven onaangetast.
  const metFout = new Set((state.resultaat?.waarschuwingen || []).filter((w) => w.bron === lijst && Number.isInteger(w.regelIndex)).map((w) => w.regelIndex));
  // Historie: nieuwste eerst. Open orders: in volgorde van invoer.
  const volgorde = regels.map((_, i) => i);
  if (lijst === 'historie') volgorde.reverse();
  const zichtbaar = volgorde.slice(0, ui.zichtbaar[lijst]);
  const rijen = zichtbaar.map((i) => {
    const r = regels[i];
    const fout = metFout.has(i);
    return `<tr${fout ? ' class="heeft-fout" title="Deze regel wordt overgeslagen of past niet; zie de meldingen."' : ''}>
      ${KOLOMMEN.map((k) => celHTML(lijst, i, k, r)).join('')}
      <td><button type="button" class="del" id="${lijst}-${i}-del" data-del="${i}" aria-label="Regel ${i + 1} verwijderen" title="Regel verwijderen">×</button></td>
    </tr>`;
  });
  const koppen = KOLOMMEN.map((k) => (k.soort === 'tekst' ? k.kop : [k.kop, 'num'])).concat([['', '']]);
  const rest = regels.length - zichtbaar.length;
  const leeg = regels.length === 0
    ? `<div class="leeg-staat">Nog geen regels in ${esc(LIJSTEN[lijst].naam.toLowerCase())}. Voeg een regel toe, importeer een CSV of laad de voorbeelddata.</div>`
    : '';
  return `${regels.length ? tabel({ id: tabelId, koppen, rijen, klasse: 'orders' }) : `<table id="${tabelId}" hidden></table>${leeg}`}
    ${rest > 0 ? `<div class="meer">Je ziet ${getal(zichtbaar.length, 0)} van ${getal(regels.length, 0)} regels.
      <button type="button" class="knop knop-klein" id="btn-meer-regels">Toon ${getal(Math.min(rest, STAP[lijst]), 0)} meer</button></div>` : ''}`;
}

function meldingenHTML(state) {
  const w = state.resultaat?.waarschuwingen || [];
  if (!state.resultaat) return '';
  if (!w.length) return '<p class="ok-regel">Alle regels zijn verwerkt.</p>';
  const items = w.map((x) => `<li class="waarschuwing"><span class="bron">${esc(BRON_LABEL[x.bron] || x.bron)}</span>${esc(x.melding)}</li>`).join('');
  const n = w.length;
  return `<details class="meldingen" id="meldingen">
    <summary>${getal(n, 0)} ${n === 1 ? 'regel' : 'regels'} overgeslagen</summary>
    <ul class="foutlijst">${items}</ul>
  </details>`;
}

function importVoorbeeld() {
  if (!ui.importTekst.trim()) {
    return { html: '<p class="import-status uitleg">Plak hierboven regels of kies een bestand. Je ziet eerst wat er herkend is.</p>', fouten: '' };
  }
  const { regels, fouten } = parseOrdersCSV(ui.importTekst, vandaag(), { datumVerplicht: ui.importLijst === 'historie' });
  const rijen = regels.slice(0, 5).map((r) => `<tr><td class="tekst">${esc(r.orderNr)}</td><td class="tekst">${esc(r.product)}</td><td class="tekst">${esc(r.stof)}</td><td class="waarde">${getal(r.breedte, 0)} × ${getal(r.hoogte, 0)}</td><td class="waarde">${getal(r.aantal, 0)}</td></tr>`);
  const status = `<p class="import-status" id="import-telling"><b>${getal(regels.length, 0)}</b> ${regels.length === 1 ? 'regel' : 'regels'} herkend${fouten.length ? `, <b>${getal(fouten.length, 0)}</b> ${fouten.length === 1 ? 'fout' : 'fouten'}` : ''}.</p>`;
  const tabelHtml = regels.length
    ? `<div class="voorbeeld-tabel">${tabel({ koppen: ['Ordernr', 'Product', 'Stof', ['Maat cm', 'num'], ['Aantal', 'num']], rijen })}</div>${regels.length > 5 ? `<p class="uitleg">en nog ${getal(regels.length - 5, 0)} regels</p>` : ''}`
    : '';
  const foutHtml = fouten.map((f) => `<li>Regel ${getal(f.regelNr, 0)}: ${esc(f.melding)}</li>`).join('');
  return { html: status + tabelHtml, fouten: foutHtml };
}

function importPaneelHTML(lijst) {
  ui.importLijst = lijst;
  const vb = importVoorbeeld();
  return `<section class="paneel" aria-labelledby="import-titel">
    <div class="paneel-kop"><h3 id="import-titel">Orders importeren</h3></div>
    <p class="uitleg">Plak regels uit Excel of een CSV-bestand. Kolommen: ordernr, datum, product, stof, breedte, hoogte, aantal (maten in cm). Scheidingsteken ; , of tab. Datum als 2026-11-02 of 2-11-2026${lijst === 'historie' ? '; voor de historie is de datum verplicht' : ''}.</p>
    <div>
      <label class="veld-label" for="import-tekst">Geplakte regels</label>
      <textarea id="import-tekst" rows="6" spellcheck="false" placeholder="${esc(VOORBEELD_CSV)}">${esc(ui.importTekst)}</textarea>
    </div>
    <div>
      <label class="veld-label" for="import-bestand">Of kies een bestand</label>
      <input type="file" id="import-bestand" accept=".csv,.txt,.tsv,text/csv,text/plain">
    </div>
    <div id="import-voorbeeld">${vb.html}</div>
    <ul class="foutlijst" id="import-fouten" aria-live="polite">${vb.fouten}</ul>
    <div class="werkbalk">
      <button type="button" class="knop knop-hoofd" id="btn-import">Toevoegen aan ${esc(LIJSTEN[lijst].naam.toLowerCase())}</button>
    </div>
    <p class="import-status" id="import-melding" aria-live="polite">${esc(ui.importMelding)}</p>
  </section>`;
}

function werkbalkHTML(state, lijst) {
  const n = (l) => getal(state.scenario[LIJSTEN[l].sleutel].length, 0);
  const leeg = ui.bevestigLeeg
    ? `<span class="bevestig" role="group" aria-label="Leegmaken bevestigen"><span>Alle ${esc(LIJSTEN[lijst].naam.toLowerCase())} wissen?</span>
        <button type="button" class="knop knop-gevaar knop-klein" id="btn-leeg-ja">Ja, leegmaken</button>
        <button type="button" class="knop knop-klein" id="btn-leeg-nee">Annuleren</button></span>`
    : '<button type="button" class="knop knop-gevaar" id="btn-leeg">Leegmaken</button>';
  return `<div class="scherm-kop">
    <div class="schakel" role="group" aria-label="Welke orders">
      ${Object.entries(LIJSTEN).map(([k, v]) => `<button type="button" id="orders-tab-${k}" data-orders-tab="${k}" aria-pressed="${k === lijst}">${v.naam}<span class="aantal">${n(k)}</span></button>`).join('')}
    </div>
    <div class="werkbalk">
      <button type="button" class="knop" id="btn-voorbeeld">Voorbeelddata laden</button>
      ${leeg}
    </div>
  </div>`;
}

function lijstOpties(state) {
  const opt = (lijst) => lijst.map((x) => `<option value="${esc(x.code)}">${esc(x.naam)}</option>`).join('');
  return `<datalist id="lijst-stoffen">${opt(state.scenario.stoffen)}</datalist>
    <datalist id="lijst-producten">${opt(state.scenario.producttypes)}</datalist>`;
}

// Bij het verlaten van het Orders-scherm: een openstaande leegmaak-vraag vervalt.
export function verlaatOrders() {
  ui.bevestigLeeg = false;
}

export function renderOrders(el, state, acties) {
  const lijst = state.ordersTab === 'historie' ? 'historie' : 'open';
  const { sleutel, naam } = LIJSTEN[lijst];
  const regels = state.scenario[sleutel];
  const uitleg = lijst === 'open'
    ? 'De orders die je nu moet snijden. Hieruit rekent RollNest de harde stofbehoefte.'
    : 'Afgeronde orders van de afgelopen maanden. Hieruit rekent RollNest het verwachte verbruik per maand.';

  el.innerHTML = `${werkbalkHTML(state, lijst)}
    <div class="orders-grid">
      <section class="paneel" aria-labelledby="orders-titel">
        <div class="paneel-kop">
          <h2 id="orders-titel">${esc(naam)} <span class="tel">${getal(regels.length, 0)} regels</span></h2>
          <button type="button" class="knop knop-klein" id="btn-regel-toevoegen">Regel toevoegen</button>
        </div>
        <p class="uitleg">${uitleg}</p>
        ${tabelHTML(state, lijst)}
        ${lijstOpties(state)}
      </section>
      <div class="zijkant">
        ${meldingenHTML(state)}
        ${importPaneelHTML(lijst)}
      </div>
    </div>`;

  const openMeldingen = el.querySelector('#meldingen');
  if (openMeldingen && ui.meldingenOpen) openMeldingen.open = true;
  openMeldingen?.addEventListener('toggle', () => { ui.meldingenOpen = openMeldingen.open; });

  el.onclick = (e) => {
    const knop = e.target.closest('button');
    if (!knop) return;
    if (knop.dataset.ordersTab) {
      ui.bevestigLeeg = false;
      ui.importMelding = '';
      acties.zet('ordersTab', knop.dataset.ordersTab);
    } else if (knop.dataset.del !== undefined) {
      const i = Number(knop.dataset.del);
      const nieuw = regels.filter((_, j) => j !== i);
      const volgende = nieuw.length ? `${lijst}-${Math.min(i, nieuw.length - 1)}-del` : 'btn-regel-toevoegen';
      acties.vervang(sleutel, nieuw, { focus: volgende });
    } else if (knop.id === 'btn-regel-toevoegen') {
      const nr = `${lijst === 'open' ? 'N' : 'H'}-${String(regels.length + 1).padStart(3, '0')}`;
      const regel = {
        orderNr: nr,
        datum: vandaag(),
        product: state.scenario.producttypes[0]?.code ?? '',
        stof: state.scenario.stoffen[0]?.code ?? '',
        breedte: null,
        hoogte: null,
        aantal: 1,
      };
      const nieuw = [...regels, regel];
      const i = nieuw.length - 1;
      if (lijst === 'open') ui.zichtbaar.open = Math.max(ui.zichtbaar.open, nieuw.length);
      acties.vervang(sleutel, nieuw, { focus: `${lijst}-${i}-breedte` });
    } else if (knop.id === 'btn-meer-regels') {
      ui.zichtbaar[lijst] += STAP[lijst];
      acties.zet('ordersTab', lijst);
    } else if (knop.id === 'btn-voorbeeld') {
      ui.bevestigLeeg = false;
      acties.laadVoorbeeld();
    } else if (knop.id === 'btn-leeg') {
      ui.bevestigLeeg = true;
      acties.zet('ordersTab', lijst);
      document.getElementById('btn-leeg-nee')?.focus();
    } else if (knop.id === 'btn-leeg-nee') {
      ui.bevestigLeeg = false;
      acties.zet('ordersTab', lijst);
      document.getElementById('btn-leeg')?.focus();
    } else if (knop.id === 'btn-leeg-ja') {
      ui.bevestigLeeg = false;
      acties.vervang(sleutel, [], { focus: 'btn-leeg' });
      acties.melding(`${naam} leeggemaakt.`);
    } else if (knop.id === 'btn-import') {
      importeer(state, acties, lijst);
    }
  };

  el.onchange = (e) => {
    const t = e.target;
    if (t.id === 'import-bestand') return leesBestand(t, el);
    if (t.dataset.veld === undefined || t.dataset.i === undefined) return;
    const i = Number(t.dataset.i);
    const kol = KOLOMMEN.find((k) => k.veld === t.dataset.veld);
    let waarde;
    if (kol.soort === 'tekst') {
      waarde = t.value.trim();
    } else {
      const n = leesGetal(t.value);
      const geldig = n != null && Number.isFinite(n) && n > 0 && (kol.soort !== 'geheel' || Number.isInteger(n));
      waarde = geldig ? n : null;
      t.setAttribute('aria-invalid', geldig ? 'false' : 'true');
      if (geldig) t.value = invoer(n);
    }
    acties.wijzig([sleutel, i, kol.veld], waarde);
  };

  el.oninput = (e) => {
    if (e.target.id !== 'import-tekst') return;
    ui.importTekst = e.target.value;
    ui.importMelding = '';
    werkImportVoorbeeldBij(el);
  };
}

function werkImportVoorbeeldBij(el) {
  const vb = importVoorbeeld();
  el.querySelector('#import-voorbeeld').innerHTML = vb.html;
  el.querySelector('#import-fouten').innerHTML = vb.fouten;
  const m = el.querySelector('#import-melding');
  if (m) m.textContent = ui.importMelding;
}

function leesBestand(input, el) {
  const bestand = input.files?.[0];
  if (!bestand) return;
  const lezer = new FileReader();
  lezer.onload = () => {
    ui.importTekst = String(lezer.result);
    ui.importMelding = `Bestand ${bestand.name} gelezen. Controleer het voorbeeld en klik op Toevoegen.`;
    const ta = el.querySelector('#import-tekst');
    if (ta) ta.value = ui.importTekst;
    werkImportVoorbeeldBij(el);
  };
  lezer.onerror = () => {
    ui.importMelding = 'Het bestand kon niet worden gelezen.';
    werkImportVoorbeeldBij(el);
  };
  lezer.readAsText(bestand);
}

function importeer(state, acties, lijst) {
  const ta = document.getElementById('import-tekst');
  if (ta) ui.importTekst = ta.value;
  const { regels, fouten } = parseOrdersCSV(ui.importTekst, vandaag(), { datumVerplicht: lijst === 'historie' });
  if (!regels.length) {
    ui.importMelding = fouten.length ? 'Geen regels toegevoegd: los eerst de fouten op.' : 'Er staat nog niets om te importeren.';
    acties.zet('ordersTab', lijst);
    return;
  }
  const { sleutel, naam } = LIJSTEN[lijst];
  ui.importTekst = '';
  ui.importMelding = `${getal(regels.length, 0)} ${regels.length === 1 ? 'regel' : 'regels'} toegevoegd aan ${naam.toLowerCase()}${fouten.length ? `, ${getal(fouten.length, 0)} overgeslagen` : ''}.`;
  if (lijst === 'open') ui.zichtbaar.open = Math.max(ui.zichtbaar.open, state.scenario.openOrders.length + regels.length);
  acties.vervang(sleutel, [...state.scenario[sleutel], ...regels], { focus: 'btn-import' });
}
