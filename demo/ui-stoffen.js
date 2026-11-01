// Stoffen & regels: catalogus, producttypes, voorraad, instellingen en de eigen inschatting per stof.
import { esc, getal, invoer, leesGetal, tabel } from './format.js';

// soort: tekst | getal (≥ 0) | positief (> 0) | vink | keuze
const TABELLEN = {
  stoffen: {
    titel: 'Stoffen',
    uitleg: 'Je stoffencatalogus. Draaien: “Nooit” bij streep of structuur, “Alleen als te breed” draait een doek alleen als het anders niet op de rol past (screens: glansverschil), “Vrij” laat RollNest draaien waar het stof bespaart.',
    toevoegen: 'Stof toevoegen',
    kolommen: [
      { veld: 'code', kop: 'Code', soort: 'tekst', breedte: 'w-s' },
      { veld: 'naam', kop: 'Naam', soort: 'tekst', breedte: 'w-xl' },
      { veld: 'rolbreedte', kop: 'Rolbreedte cm', soort: 'positief', breedte: 'w-s' },
      { veld: 'rollengte', kop: 'Rollengte m', soort: 'positief', breedte: 'w-s' },
      { veld: 'prijsPerM1', kop: 'Prijs per m¹ €', soort: 'getal', breedte: 'w-s' },
      { veld: 'draaien', kop: 'Draaien', soort: 'keuze', opties: [['nooit', 'Nooit'], ['alsTeBreed', 'Alleen als te breed'], ['vrij', 'Vrij']] },
    ],
    uniek: 'code',
    nieuw: (lijst) => ({ code: uniekeCode(lijst, 'code', 'STOF'), naam: 'Nieuwe stof', rolbreedte: 300, rollengte: 40, prijsPerM1: 10, draaien: 'alsTeBreed' }),
  },
  producttypes: {
    titel: 'Producttypes',
    uitleg: 'De confectietoeslag per product: zoveel cm komt er bij de ordermaat voor zomen, kokers en naden. Banen: een te breed doek mag uit aan elkaar genaaide banen bestaan (zonneschermdoek wel, screens en rolgordijnen niet).',
    toevoegen: 'Producttype toevoegen',
    kolommen: [
      { veld: 'code', kop: 'Code', soort: 'tekst', breedte: 'w-m' },
      { veld: 'naam', kop: 'Naam', soort: 'tekst', breedte: 'w-l' },
      { veld: 'toeslagBreedte', kop: 'Toeslag breedte cm', soort: 'getal', breedte: 'w-s' },
      { veld: 'toeslagHoogte', kop: 'Toeslag hoogte cm', soort: 'getal', breedte: 'w-s' },
      { veld: 'banenToegestaan', kop: 'Banen', soort: 'vink' },
    ],
    nieuw: (lijst) => ({ code: uniekeCode(lijst, 'code', 'product'), naam: 'Nieuw product', toeslagBreedte: 0, toeslagHoogte: 0, banenToegestaan: false }),
  },
  voorraad: {
    titel: 'Voorraad',
    uitleg: 'Wat er al op de plank ligt. RollNest snijdt eerst uit reststukken (kortste eerst), dan uit voorraadrollen en pas daarna uit nieuwe rollen.',
    toevoegen: 'Voorraad toevoegen',
    kolommen: [
      { veld: 'id', kop: 'ID', soort: 'tekst', breedte: 'w-m' },
      { veld: 'stof', kop: 'Stof', soort: 'tekst', breedte: 'w-s', lijst: 'lijst-stofcodes' },
      { veld: 'soort', kop: 'Soort', soort: 'keuze', opties: [['rol', 'Rol'], ['reststuk', 'Reststuk']] },
      { veld: 'breedte', kop: 'Breedte cm', soort: 'positief', breedte: 'w-s' },
      { veld: 'lengte', kop: 'Lengte cm', soort: 'positief', breedte: 'w-s' },
    ],
    uniek: 'id',
    nieuw: (lijst, sc) => {
      const stof = sc.stoffen[0];
      return { id: uniekeCode(lijst, 'id', 'V'), stof: stof?.code ?? '', soort: 'rol', breedte: stof?.rolbreedte ?? 300, lengte: (stof?.rollengte ?? 40) * 100 };
    },
  },
};

const INSTELLINGEN = [
  { veld: 'naadtoeslag', label: 'Naadtoeslag', eenheid: 'cm', hulp: 'Extra stof per naad als een doek uit meerdere banen bestaat.' },
  { veld: 'snijspeling', label: 'Snijspeling', eenheid: 'cm', hulp: 'Ruimte tussen twee stukken op de rol.' },
  { veld: 'minReststukLengte', label: 'Minimale reststuklengte', eenheid: 'cm', hulp: 'Een kortere restlengte op de rol telt als verlies.' },
  { veld: 'gevoelToeslag', label: 'Toeslag vuistregel', eenheid: '%', hulp: 'De verliestoeslag waarmee je nu op gevoel inkoopt.' },
  { veld: 'historieMaanden', label: 'Historie voor verwachting', eenheid: 'mnd', hulp: 'Zoveel recente maanden tellen mee voor het verwachte verbruik.', geheel: true },
];
const HORIZON = [[0, 'Alleen open orders'], [1, '1 maand vooruit'], [3, '3 maanden vooruit']];

function uniekeCode(lijst, veld, basis) {
  const bestaand = new Set(lijst.map((x) => String(x[veld])));
  let n = lijst.length + 1;
  while (bestaand.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}

// Waarden die vaker dan één keer voorkomen (stofcodes hoofdletterongevoelig).
function dubbeleWaarden(lijst, veld) {
  const tel = new Map();
  const k = (v) => String(v ?? '').trim().toLowerCase();
  for (const x of lijst) tel.set(k(x[veld]), (tel.get(k(x[veld])) || 0) + 1);
  return new Set(lijst.map((x) => x[veld]).filter((v) => k(v) !== '' && tel.get(k(v)) > 1).map(k));
}

function celHTML(tab, i, kol, rij, dubbel) {
  const id = `${tab}-${i}-${kol.veld}`;
  const isDubbel = dubbel && kol.veld === TABELLEN[tab].uniek && dubbel.has(String(rij[kol.veld] ?? '').trim().toLowerCase());
  const label = `aria-label="${esc(kol.kop)}, regel ${i + 1}"${isDubbel ? ` aria-invalid="true" aria-describedby="dubbel-${tab}"` : ''}`;
  const v = rij[kol.veld];
  if (kol.soort === 'vink') {
    return `<td class="vink"><input type="checkbox" id="${id}" data-i="${i}" data-veld="${kol.veld}" ${v ? 'checked' : ''} ${label}></td>`;
  }
  if (kol.soort === 'keuze') {
    const opties = kol.opties.map(([w, t]) => `<option value="${w}"${w === v ? ' selected' : ''}>${t}</option>`).join('');
    return `<td><select class="cel" id="${id}" data-i="${i}" data-veld="${kol.veld}" ${label}>${opties}</select></td>`;
  }
  const num = kol.soort !== 'tekst';
  const ongeldig = num && !geldigGetal(v, kol.soort) && !isDubbel;
  return `<td><input class="cel ${kol.breedte || ''}${num ? ' num' : ''}" id="${id}" data-i="${i}" data-veld="${kol.veld}"
    value="${esc(num ? invoer(v) : v ?? '')}"${num ? ' inputmode="decimal"' : ''}${kol.lijst ? ` list="${kol.lijst}"` : ''}
    ${ongeldig ? 'aria-invalid="true"' : ''} autocomplete="off" spellcheck="false" ${label}></td>`;
}

function geldigGetal(n, soort) {
  return typeof n === 'number' && Number.isFinite(n) && (soort === 'positief' ? n > 0 : n >= 0);
}

function tabelPaneel(state, tab) {
  const def = TABELLEN[tab];
  const lijst = state.scenario[tab];
  const dubbel = def.uniek ? dubbeleWaarden(lijst, def.uniek) : null;
  const dubbelTekst = dubbel?.size ? esc([...new Set(lijst.map((x) => String(x[def.uniek] ?? '').trim()).filter((v) => dubbel.has(v.toLowerCase())))].join(', ')) : '';
  const rijen = lijst.map((rij, i) => `<tr>${def.kolommen.map((k) => celHTML(tab, i, k, rij, dubbel)).join('')}
    <td><button type="button" class="del" id="${tab}-${i}-del" data-tabel="${tab}" data-del="${i}" aria-label="Regel ${i + 1} verwijderen" title="Verwijderen">×</button></td></tr>`);
  const koppen = def.kolommen.map((k) => (k.soort === 'tekst' || k.soort === 'keuze' ? k.kop : k.soort === 'vink' ? [k.kop, 'vink'] : [k.kop, 'num'])).concat([['', '']]);
  return `<section class="paneel" aria-labelledby="titel-${tab}">
    <div class="paneel-kop">
      <h2 id="titel-${tab}">${def.titel} <span class="tel">${getal(lijst.length, 0)}</span></h2>
      <button type="button" class="knop knop-klein" id="btn-toevoegen-${tab}" data-toevoegen="${tab}">${def.toevoegen}</button>
    </div>
    <p class="uitleg">${def.uitleg}</p>
    ${lijst.length ? tabel({ id: `tabel-${tab}`, koppen, rijen }) : '<div class="leeg-staat">Nog niets ingevoerd.</div>'}
    ${dubbel?.size ? `<p class="fout-tekst" id="dubbel-${tab}">${tab === 'stoffen'
    ? `Dubbele stofcode: ${dubbelTekst}. RollNest rekent alleen met de eerste; geef elke stof een eigen code.`
    : `Dubbel ID: ${dubbelTekst}. Geef elk stuk voorraad een eigen ID, dan vind je het op de snijplannen terug.`}</p>` : ''}
  </section>`;
}

function instellingenPaneel(state) {
  const inst = state.scenario.instellingen;
  const velden = INSTELLINGEN.map((d) => `<div class="veld">
      <label for="inst-${d.veld}">${d.label}</label>
      <div class="invoer-eenheid"><input id="inst-${d.veld}" data-instelling="${d.veld}" inputmode="decimal" autocomplete="off"
        value="${esc(invoer(inst[d.veld]))}" aria-describedby="inst-${d.veld}-hulp"><span class="eenheid">${d.eenheid}</span></div>
      <small id="inst-${d.veld}-hulp">${d.hulp}</small>
    </div>`).join('');
  const horizon = Number(inst.horizonMaanden);
  const opties = HORIZON.map(([w, t]) => `<option value="${w}"${w === horizon ? ' selected' : ''}>${t}</option>`).join('');
  return `<section class="paneel" aria-labelledby="titel-instellingen">
    <div class="paneel-kop"><h2 id="titel-instellingen">Rekenregels</h2></div>
    <div class="instellingen">
      ${velden}
      <div class="veld">
        <label for="inst-horizonMaanden">Inkopen voor</label>
        <div class="invoer-eenheid"><select id="inst-horizonMaanden" data-instelling="horizonMaanden" aria-describedby="inst-horizonMaanden-hulp">${opties}</select></div>
        <small id="inst-horizonMaanden-hulp">Hoe ver vooruit je stof inkoopt, bovenop de open orders.</small>
      </div>
    </div>
  </section>`;
}

function gevoelPaneel(state) {
  const sc = state.scenario;
  const pct = getal(Number(sc.instellingen.gevoelToeslag) || 0, 0);
  const rijen = sc.stoffen.map((stof, i) => {
    const ink = state.resultaat?.perStof?.[stof.code]?.inkoop;
    const eigen = sc.gevoel?.[stof.code];
    // Vuistregel = netto + toeslag, ook als je zelf een getal invult.
    const verbruik = state.resultaat?.perStof?.[stof.code]?.verbruik;
    const vuistregel = verbruik && stof.rolbreedte > 0
      ? (verbruik.totaal.nettoM2 * (1 + (Number(sc.instellingen.gevoelToeslag) || 0) / 100)) / (stof.rolbreedte / 100)
      : null;
    return `<tr>
      <td class="tekst">${esc(stof.naam)} <span class="bron-tag">${esc(stof.code)}</span></td>
      <td class="waarde">${ink ? getal(ink.hardBrutoM1) : '–'}</td>
      <td class="waarde">${vuistregel != null ? getal(vuistregel) : '–'}</td>
      <td><input class="cel num w-m" id="gevoel-${i}" data-gevoel="${esc(stof.code)}" inputmode="decimal" autocomplete="off"
        value="${esc(invoer(eigen))}" placeholder="vuistregel"
        aria-label="Wat zou je zelf bestellen voor ${esc(stof.naam)}, in m¹"></td>
    </tr>`;
  });
  return `<section class="paneel" aria-labelledby="titel-gevoel">
    <div class="paneel-kop"><h2 id="titel-gevoel">Je eigen inschatting</h2></div>
    <p class="uitleg">Hoeveel m¹ zou je zelf bestellen voor de open orders? Laat een veld leeg om de vuistregel te gebruiken: netto stof plus ${pct}% verlies. RollNest vergelijkt dat met wat het snijplan echt nodig heeft.</p>
    ${sc.stoffen.length ? tabel({ id: 'tabel-gevoel', koppen: ['Stof', ['Snijplan m¹', 'num'], [`Vuistregel +${pct}% m¹`, 'num'], ['Wat zou je zelf bestellen (m¹)', 'num']], rijen }) : '<div class="leeg-staat">Voeg eerst een stof toe.</div>'}
  </section>`;
}

export function renderStoffen(el, state, acties) {
  const sc = state.scenario;
  el.innerHTML = `
    <div class="scherm-kop">
      <h2 class="sr-only">Stoffen &amp; regels</h2>
      <p>Hier staat waarmee RollNest rekent: je stoffen, de toeslagen per product, wat er op voorraad ligt en je rekenregels.</p>
    </div>
    <div class="stoffen-boven">
      ${instellingenPaneel(state)}
      ${gevoelPaneel(state)}
    </div>
    ${tabelPaneel(state, 'stoffen')}
    ${tabelPaneel(state, 'producttypes')}
    ${tabelPaneel(state, 'voorraad')}
    <datalist id="lijst-stofcodes">${sc.stoffen.map((s) => `<option value="${esc(s.code)}">${esc(s.naam)}</option>`).join('')}</datalist>`;

  el.onclick = (e) => {
    const knop = e.target.closest('button');
    if (!knop) return;
    if (knop.dataset.toevoegen) {
      const tab = knop.dataset.toevoegen;
      const lijst = sc[tab];
      const nieuw = [...lijst, TABELLEN[tab].nieuw(lijst, sc)];
      acties.vervang(tab, nieuw, { focus: `${tab}-${nieuw.length - 1}-${TABELLEN[tab].kolommen[0].veld}` });
    } else if (knop.dataset.del !== undefined) {
      const tab = knop.dataset.tabel;
      const i = Number(knop.dataset.del);
      const nieuw = sc[tab].filter((_, j) => j !== i);
      acties.vervang(tab, nieuw, { focus: nieuw.length ? `${tab}-${Math.min(i, nieuw.length - 1)}-del` : `btn-toevoegen-${tab}` });
    }
  };

  el.onchange = (e) => {
    const t = e.target;
    if (t.dataset.instelling) return wijzigInstelling(t, sc, acties);
    if (t.dataset.gevoel !== undefined) {
      const n = leesGetal(t.value);
      if (n == null) return acties.wijzig(['gevoel', t.dataset.gevoel], undefined);
      const geldig = Number.isFinite(n) && n >= 0;
      t.setAttribute('aria-invalid', geldig ? 'false' : 'true');
      if (!geldig) return;
      t.value = invoer(n);
      return acties.wijzig(['gevoel', t.dataset.gevoel], n);
    }
    const tab = t.closest('table')?.id?.replace('tabel-', '');
    const def = TABELLEN[tab];
    if (!def || t.dataset.i === undefined) return;
    const kol = def.kolommen.find((k) => k.veld === t.dataset.veld);
    const i = Number(t.dataset.i);
    let waarde;
    if (kol.soort === 'vink') waarde = t.checked;
    else if (kol.soort === 'keuze' || kol.soort === 'tekst') waarde = t.value.trim();
    else {
      const n = leesGetal(t.value);
      const geldig = geldigGetal(n, kol.soort);
      t.setAttribute('aria-invalid', geldig ? 'false' : 'true');
      waarde = geldig ? n : null;
      if (geldig) t.value = invoer(n);
    }
    // Een andere stofcode: neem de eigen inschatting mee naar de nieuwe code.
    if (tab === 'stoffen' && kol.veld === 'code') {
      const oud = sc.stoffen[i].code;
      if (sc.gevoel?.[oud] !== undefined && waarde && waarde !== oud) {
        acties.wijzig(['gevoel', waarde], sc.gevoel[oud]);
        acties.wijzig(['gevoel', oud], undefined);
      }
    }
    acties.wijzig([tab, i, kol.veld], waarde);
  };
}

function wijzigInstelling(t, sc, acties) {
  const veld = t.dataset.instelling;
  if (veld === 'horizonMaanden') return acties.wijzig(['instellingen', veld], Number(t.value));
  const def = INSTELLINGEN.find((d) => d.veld === veld);
  const n = leesGetal(t.value);
  const geldig = n != null && Number.isFinite(n) && n >= 0 && (!def.geheel || (Number.isInteger(n) && n >= 1));
  t.setAttribute('aria-invalid', geldig ? 'false' : 'true');
  if (!geldig) {
    t.value = invoer(sc.instellingen[veld]);
    t.setAttribute('aria-invalid', 'false');
    return;
  }
  t.value = invoer(n);
  acties.wijzig(['instellingen', veld], n);
}
