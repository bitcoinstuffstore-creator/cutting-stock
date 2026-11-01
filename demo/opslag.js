// Opslag van het scenario. Werkt met elk object met getItem/setItem (localStorage of een nep).
export const SLEUTEL = 'rollnest-scenario-v1';

export function laadScenario(storage, fallback) {
  try {
    const tekst = storage.getItem(SLEUTEL);
    if (tekst == null) return fallback();
    const sc = JSON.parse(tekst);
    if (!sc || typeof sc !== 'object' || sc.versie !== 1) return fallback();
    return sc;
  } catch {
    return fallback();
  }
}

export function bewaarScenario(storage, scenario) {
  try {
    storage.setItem(SLEUTEL, JSON.stringify(scenario));
    return true;
  } catch {
    return false;
  }
}

// Gekozen thema (auto | light | dark): een gemak per kijker, dus stil terugvallen op 'auto'.
export const THEMA_SLEUTEL = 'rollnest-thema';
const THEMAS = ['auto', 'light', 'dark'];

export function laadThema(storage) {
  try {
    const t = storage.getItem(THEMA_SLEUTEL);
    return THEMAS.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function bewaarThema(storage, thema) {
  try {
    storage.setItem(THEMA_SLEUTEL, thema);
    return true;
  } catch {
    return false;
  }
}
