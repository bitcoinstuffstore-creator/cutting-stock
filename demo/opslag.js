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
