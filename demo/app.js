// RollNest demo: state, opslag, debounce, tab-routing en de kopcijfers.
import { analyseer } from './engine/index.js';
import { voorbeeldScenario } from './engine/voorbeelddata.js';
import { laadScenario, bewaarScenario, laadThema, bewaarThema } from './opslag.js';
import { normaliseer } from './scenario.js';
import { getal, euro, esc, tabel } from './format.js';
import { exportPaneelHTML, kopieer } from './export-paneel.js';
import { renderOrders, verlaatOrders } from './ui-orders.js';
import { renderStoffen } from './ui-stoffen.js';

const TABS = ['orders', 'stoffen', 'resultaat'];
const NOOP_OPSLAG = { getItem: () => null, setItem() {} };

function kiesOpslag() {
  try {
    return window.localStorage || NOOP_OPSLAG;
  } catch {
    return NOOP_OPSLAG;
  }
}
const opslag = kiesOpslag();

const state = {
  scenario: normaliseer(laadScenario(opslag, voorbeeldScenario)),
  resultaat: null,
  fout: null,
  rekent: false,
  tab: 'orders',
  subtab: 'inkoop',
  ordersTab: 'open',
  voetPaneel: null, // null | 'export' | 'import'
};

const schermEl = document.getElementById('scherm');
const voetEl = document.getElementById('voet');

// ---------- Rekenen ----------
let rekenTimer = null;
function reken() {
  rekenTimer = null;
  try {
    state.resultaat = analyseer(state.scenario);
    state.fout = null;
  } catch (e) {
    state.fout = e && e.message ? e.message : String(e);
  }
  state.rekent = false;
  render();
}
function planReken() {
  state.rekent = true;
  document.getElementById('kpis')?.setAttribute('aria-busy', 'true');
  clearTimeout(rekenTimer);
  rekenTimer = setTimeout(reken, 300);
}

function bewaar() {
  bewaarScenario(opslag, state.scenario);
}

function zetPad(obj, pad, waarde) {
  const delen = Array.isArray(pad) ? pad : String(pad).split('.');
  let o = obj;
  for (let i = 0; i < delen.length - 1; i++) {
    if (o[delen[i]] == null || typeof o[delen[i]] !== 'object') o[delen[i]] = {};
    o = o[delen[i]];
  }
  const laatste = delen[delen.length - 1];
  if (waarde === undefined) delete o[laatste];
  else o[laatste] = waarde;
}

// ---------- Acties (voor de schermen) ----------
let vorigScenario = null;
let focusNa = null;

const acties = {
  // Wijzigt één waarde. Het invoerveld toont de waarde al, dus pas na het rekenen opnieuw tekenen.
  wijzig(pad, waarde) {
    zetPad(state.scenario, pad, waarde);
    bewaar();
    planReken();
  },
  // Vervangt een heel onderdeel (lijst toevoegen/verwijderen, import, leegmaken): meteen tekenen.
  vervang(sleutel, waarde, { focus } = {}) {
    state.scenario[sleutel] = waarde;
    bewaar();
    if (focus) focusNa = focus;
    render();
    planReken();
  },
  herbereken() {
    clearTimeout(rekenTimer);
    reken();
  },
  // UI-toestand (geen scenario): ordersTab, subtab, tab.
  zet(sleutel, waarde) {
    state[sleutel] = waarde;
    render();
  },
  laadVoorbeeld() {
    vervangScenario(voorbeeldScenario(), 'Voorbeelddata geladen.');
  },
  melding,
};

function vervangScenario(nieuw, tekst) {
  vorigScenario = state.scenario;
  state.scenario = normaliseer(nieuw);
  try {
    render();
  } catch {
    // Kan dit scenario niet getoond worden, dan blijven de vorige gegevens staan (en worden ze niet overschreven).
    state.scenario = vorigScenario;
    vorigScenario = null;
    render();
    melding('Dit scenario kon niet worden geladen. Je vorige gegevens zijn bewaard.');
    return;
  }
  bewaar();
  planReken();
  melding(tekst, { ongedaan: true });
}

// ---------- Melding (toast) ----------
let toastTimer = null;
function melding(tekst, { ongedaan = false } = {}) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${esc(tekst)}</span>${ongedaan && vorigScenario ? '<button type="button" id="btn-ongedaan">Ongedaan maken</button>' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 7000);
}
document.getElementById('toast').addEventListener('click', (e) => {
  if (e.target.id !== 'btn-ongedaan' || !vorigScenario) return;
  state.scenario = vorigScenario;
  vorigScenario = null;
  bewaar();
  render();
  planReken();
  melding('Teruggezet naar de vorige gegevens.');
});

// ---------- Kopcijfers ----------
function renderKop() {
  const kpis = document.getElementById('kpis');
  kpis.setAttribute('aria-busy', state.rekent ? 'true' : 'false');
  const kosten = document.getElementById('kop-kosten');
  const kostenSub = document.getElementById('kop-kosten-sub');
  const verschil = document.getElementById('kop-verschil');
  const verschilSub = document.getElementById('kop-verschil-sub');
  const verlies = document.getElementById('kop-verlies');

  if (state.fout || !state.resultaat) {
    kosten.textContent = '–';
    verschil.textContent = '–';
    verlies.textContent = '–';
    kostenSub.textContent = state.fout ? `Berekening mislukt: ${state.fout}` : 'Bezig met rekenen…';
    verschilSub.textContent = '';
    return;
  }
  const t = state.resultaat.totalen;
  const h = Number(state.scenario.instellingen.horizonMaanden) || 0;
  kosten.textContent = euro(t.kosten);
  kostenSub.textContent = h === 0
    ? 'alleen de open orders'
    : `open orders + ${h} ${h === 1 ? 'maand' : 'maanden'} verwacht verbruik`;

  const pct = Math.abs(t.verschilPct);
  const soort = pct < 0.5 ? 'gelijk' : t.verschilEuro > 0 ? 'te-veel' : 'te-weinig';
  const tekst = { gelijk: 'gelijk aan berekend', 'te-veel': 'te veel met vuistregel', 'te-weinig': 'te weinig met vuistregel' }[soort];
  verschil.innerHTML = `${esc(euro(Math.abs(t.verschilEuro)))} <span class="kpi-tag" data-soort="${soort}">${esc(getal(pct, 1))}% ${esc(tekst)}</span>`;
  verschilSub.textContent = soort === 'te-weinig'
    ? 'met de vuistregel kom je stof tekort voor de open orders'
    : soort === 'te-veel'
      ? 'met de vuistregel koop je meer dan de open orders nodig hebben'
      : 'de vuistregel komt overeen met het snijplan';

  verlies.textContent = `${getal((t.verliesfactor - 1) * 100, 1)}%`;
}

// ---------- Tabs ----------
function renderTabs() {
  for (const knop of document.querySelectorAll('[data-tab]')) {
    knop.setAttribute('aria-selected', knop.dataset.tab === state.tab ? 'true' : 'false');
    knop.tabIndex = knop.dataset.tab === state.tab ? 0 : -1;
  }
  schermEl.setAttribute('aria-labelledby', `tab-${state.tab}`);
}
function kiesTab(tab, { hash = true } = {}) {
  if (!TABS.includes(tab)) return;
  if (tab !== state.tab) verlaatOrders();
  state.tab = tab;
  if (hash) {
    try { if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`); } catch { /* frame zonder history */ }
  }
  render();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const knop = e.target.closest('[data-tab]');
  if (knop) kiesTab(knop.dataset.tab);
});
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = TABS.indexOf(state.tab);
  const volgende = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  kiesTab(volgende);
  document.getElementById(`tab-${volgende}`)?.focus();
});
window.addEventListener('hashchange', () => kiesTab(location.hash.slice(1), { hash: false }));

// ---------- Voorlopig resultaatscherm (Task 10 vervangt dit door ui-resultaat.js) ----------
function renderResultaatVoorlopig(el, st) {
  if (!st.scenario.openOrders.length) {
    el.innerHTML = '<div class="paneel leeg-staat">Nog geen open orders — laad de voorbeelddata of importeer een CSV.</div>';
    return;
  }
  if (!st.resultaat) {
    el.innerHTML = '<div class="paneel leeg-staat">Bezig met rekenen…</div>';
    return;
  }
  const regels = Object.values(st.resultaat.perStof);
  const rijen = regels.map(({ stof, inkoop }) => `<tr>
      <td class="tekst">${esc(stof.naam)} <span class="bron-tag">${esc(stof.code)}</span></td>
      <td class="waarde">${getal(inkoop.teBestellenRollen, 0)}</td>
      <td class="waarde">${getal(inkoop.teBestellenM1)}</td>
      <td class="waarde">${euro(inkoop.kosten)}</td>
    </tr>`);
  const som = (f) => regels.reduce((s, r) => s + f(r.inkoop), 0);
  el.innerHTML = `
    <div class="scherm-kop"><h2>Inkoopadvies</h2><p>Zoveel stof bestel je voor deze periode, per stof.</p></div>
    <div class="paneel">
      ${tabel({ id: 'tabel-inkoop', koppen: ['Stof', ['Rollen', 'num'], ['m¹', 'num'], ['Kosten', 'num']], rijen })
        .replace('</tbody></table>', `</tbody><tfoot><tr><td>Totaal</td><td class="waarde">${getal(som((i) => i.teBestellenRollen), 0)}</td><td class="waarde">${getal(som((i) => i.teBestellenM1))}</td><td class="waarde">${euro(st.resultaat.totalen.kosten)}</td></tr></tfoot></table>`)}
    </div>`;
}

// Elk scherm: render(el, state, acties). Task 10 koppelt hier renderResultaat uit ui-resultaat.js.
const SCHERMEN = {
  orders: renderOrders,
  stoffen: renderStoffen,
  resultaat: renderResultaatVoorlopig,
};

// ---------- Voet: privacy + scenario exporteren/importeren ----------
let importScenarioTekst = '';
let voetOpen = null;
let importScenarioFout = '';

function renderVoet() {
  const paneel = state.voetPaneel === 'export'
    ? exportPaneelHTML({
      id: 'export-scenario',
      titel: 'Scenario exporteren',
      uitleg: 'Dit is je volledige scenario als JSON: stoffen, producttypes, orders, historie, voorraad en instellingen. Kopieer het en bewaar het als .json-bestand, of stuur het mee.',
      tekst: JSON.stringify(state.scenario, null, 1),
    })
    : state.voetPaneel === 'import'
      ? `<section class="paneel" id="import-scenario" aria-labelledby="import-scenario-titel">
          <div class="paneel-kop">
            <h3 id="import-scenario-titel">Scenario importeren</h3>
            <button type="button" class="knop knop-klein" id="import-scenario-sluit" data-sluit-paneel="import-scenario">Sluiten</button>
          </div>
          <p class="uitleg">Kies een eerder geëxporteerd .json-bestand, of plak de JSON hieronder. Dit vervangt alle huidige gegevens.</p>
          <div><label class="veld-label" for="import-scenario-bestand">Bestand</label>
          <input type="file" id="import-scenario-bestand" accept=".json,application/json"></div>
          <div><label class="veld-label" for="import-scenario-tekst">Of plak JSON</label>
          <textarea id="import-scenario-tekst" rows="6" spellcheck="false" placeholder='{"versie": 1, "stoffen": [...], ...}'>${esc(importScenarioTekst)}</textarea></div>
          <p class="fout-tekst" id="import-scenario-fout" role="alert">${esc(importScenarioFout)}</p>
          <div class="werkbalk"><button type="button" class="knop knop-hoofd" id="btn-scenario-laden">Scenario laden</button></div>
        </section>`
      : '';
  voetEl.innerHTML = `
    <div class="voet-rij">
      <p class="privacy">Alle gegevens blijven in je browser — er wordt niets verstuurd.</p>
      <div class="werkbalk">
        <button type="button" class="knop" id="btn-export-scenario" aria-expanded="${state.voetPaneel === 'export'}">Scenario exporteren</button>
        <button type="button" class="knop" id="btn-import-scenario" aria-expanded="${state.voetPaneel === 'import'}">Scenario importeren</button>
      </div>
    </div>
    ${paneel}`;
}

function laadScenarioTekst(tekst, bron) {
  let sc;
  try {
    sc = JSON.parse(tekst);
  } catch {
    return toonImportFout('Dit is geen geldige JSON. Controleer of je de hele tekst hebt gekopieerd.');
  }
  if (!sc || typeof sc !== 'object' || sc.versie !== 1) {
    return toonImportFout('Dit is geen RollNest-scenario van versie 1. Exporteer het scenario opnieuw vanuit RollNest.');
  }
  importScenarioTekst = '';
  importScenarioFout = '';
  state.voetPaneel = null;
  voetOpen = null;
  focusNa = 'btn-import-scenario';
  const n = Array.isArray(sc.openOrders) ? sc.openOrders.length : 0;
  vervangScenario(sc, `Scenario geladen${bron ? ` uit ${bron}` : ''}: ${n} open orders.`);
}
function toonImportFout(tekst) {
  importScenarioFout = tekst;
  const el = document.getElementById('import-scenario-fout');
  if (el) el.textContent = tekst;
}

voetEl.addEventListener('click', (e) => {
  const knop = e.target.closest('button');
  if (!knop) return;
  const opener = { export: 'btn-export-scenario', import: 'btn-import-scenario' };
  if (knop.id === opener.export) state.voetPaneel = state.voetPaneel === 'export' ? null : 'export';
  else if (knop.id === opener.import) state.voetPaneel = state.voetPaneel === 'import' ? null : 'import';
  else if (knop.dataset.sluitPaneel) state.voetPaneel = null;
  else if (knop.dataset.kopieer) return void kopieer(knop);
  else if (knop.id === 'btn-scenario-laden') return void laadScenarioTekst(importScenarioTekst, '');
  else return;
  const vorigPaneel = voetOpen;
  voetOpen = state.voetPaneel;
  importScenarioFout = '';
  renderVoet();
  if (state.voetPaneel) {
    document.getElementById(`${state.voetPaneel}-scenario`)?.scrollIntoView?.({ block: 'nearest' });
    document.getElementById(opener[state.voetPaneel])?.focus({ preventScroll: true });
  } else {
    // Paneel dicht: focus terug naar de knop die het opende.
    document.getElementById(opener[vorigPaneel] || knop.id)?.focus();
  }
});
voetEl.addEventListener('input', (e) => {
  if (e.target.id === 'import-scenario-tekst') importScenarioTekst = e.target.value;
});
voetEl.addEventListener('change', (e) => {
  if (e.target.id !== 'import-scenario-bestand' || !e.target.files?.[0]) return;
  const bestand = e.target.files[0];
  const lezer = new FileReader();
  lezer.onload = () => laadScenarioTekst(String(lezer.result), bestand.name);
  lezer.onerror = () => toonImportFout('Het bestand kon niet worden gelezen.');
  lezer.readAsText(bestand);
});

// ---------- Thema ----------
const THEMAS = ['auto', 'light', 'dark'];
const THEMA_LABEL = { auto: 'automatisch', light: 'licht', dark: 'donker' };
let thema = laadThema(opslag);
function zetThema() {
  if (thema === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', thema);
  document.getElementById('btn-thema').textContent = `Thema: ${THEMA_LABEL[thema]}`;
}
document.getElementById('btn-thema').addEventListener('click', () => {
  thema = THEMAS[(THEMAS.indexOf(thema) + 1) % THEMAS.length];
  bewaarThema(opslag, thema);
  zetThema();
});

// ---------- Tekenen met behoud van focus ----------
function bewaarFocus() {
  const a = document.activeElement;
  if (!a || !a.id || a === document.body) return null;
  const tekstveld = (a.tagName === 'INPUT' && /^(text|search|number|)$/.test(a.type)) || a.tagName === 'TEXTAREA';
  return {
    id: a.id,
    waarde: tekstveld ? a.value : undefined,
    start: tekstveld ? a.selectionStart : null,
    eind: tekstveld ? a.selectionEnd : null,
  };
}
function herstelFocus(f) {
  const id = focusNa || f?.id;
  focusNa = null;
  if (!id) return;
  const el = document.getElementById(id);
  if (!el || el === document.activeElement) return;
  if (f && id === f.id && f.waarde !== undefined && 'value' in el && !el.readOnly) {
    el.value = f.waarde;
  }
  el.focus({ preventScroll: true });
  if (f && id === f.id && f.start != null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(f.start, f.eind); } catch { /* niet elk veld */ }
  }
}

// Brede tabellen scrollen in hun eigen kader; bewaar die positie (per tabel-id) over een render heen.
function bewaarScroll() {
  const pos = new Map();
  for (const kader of schermEl.querySelectorAll('.tabel-scroll')) {
    const id = kader.querySelector('table')?.id;
    if (id) pos.set(id, [kader.scrollLeft, kader.scrollTop]);
  }
  return pos;
}
function herstelScroll(pos) {
  for (const [id, [links, boven]] of pos) {
    const kader = document.getElementById(id)?.closest('.tabel-scroll');
    if (kader) { kader.scrollLeft = links; kader.scrollTop = boven; }
  }
}

function render() {
  const f = bewaarFocus();
  const scroll = bewaarScroll();
  renderKop();
  renderTabs();
  // Elk scherm zet zijn eigen handlers; die van een vorig scherm mogen niet blijven hangen.
  schermEl.onclick = null;
  schermEl.onchange = null;
  schermEl.oninput = null;
  SCHERMEN[state.tab](schermEl, state, acties);
  renderVoet();
  herstelScroll(scroll);
  herstelFocus(f);
}

// ---------- Start ----------
zetThema();
if (TABS.includes(location.hash.slice(1))) state.tab = location.hash.slice(1);
try {
  reken();
} catch {
  // Opgeslagen gegevens die niet te tonen zijn: start met de voorbeelddata in plaats van een leeg scherm.
  state.scenario = normaliseer(voorbeeldScenario());
  bewaar();
  reken();
  melding('Je opgeslagen gegevens konden niet worden geopend. De voorbeelddata is geladen.');
}
