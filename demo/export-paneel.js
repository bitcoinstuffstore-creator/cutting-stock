// In-page exportpaneel: downloads werken niet in het artifact-frame, dus tekst + Kopiëren-knop.
import { esc } from './format.js';

export function exportPaneelHTML({ id, titel, uitleg = '', tekst, rijen = 8 }) {
  return `<section class="paneel" id="${id}" aria-labelledby="${id}-titel">
    <div class="paneel-kop">
      <h3 id="${id}-titel">${esc(titel)}</h3>
      <div class="werkbalk">
        <button type="button" class="knop knop-hoofd knop-klein" id="${id}-kopieer" data-kopieer="${id}-tekst">Kopiëren</button>
        <button type="button" class="knop knop-klein" id="${id}-sluit" data-sluit-paneel="${id}">Sluiten</button>
      </div>
    </div>
    ${uitleg ? `<p class="uitleg">${esc(uitleg)}</p>` : ''}
    <label class="sr-only" for="${id}-tekst">${esc(titel)}</label>
    <textarea id="${id}-tekst" rows="${rijen}" readonly spellcheck="false">${esc(tekst)}</textarea>
    <p class="kopieer-status" id="${id}-tekst-status" aria-live="polite"></p>
  </section>`;
}

// Aanroepen vanuit de click-handler van een [data-kopieer]-knop.
export async function kopieer(knop) {
  const ta = document.getElementById(knop.dataset.kopieer);
  const status = document.getElementById(`${knop.dataset.kopieer}-status`);
  if (!ta) return;
  try {
    await navigator.clipboard.writeText(ta.value);
    if (status) status.textContent = 'Gekopieerd naar het klembord.';
  } catch {
    ta.focus();
    ta.select();
    if (status) status.textContent = 'Selecteer en kopieer handmatig (Ctrl/Cmd+C).';
  }
}
