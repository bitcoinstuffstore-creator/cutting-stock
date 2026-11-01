# RollNest demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A demo published as an artifact. It turns zonwering orders into an inkoopadvies per stof (the purchase advice per fabric), based on nesting, and shows per-doek consumption, norms and cutting plans as the supporting evidence.

**Architecture:**
- **Rekenkern (`engine/`):** a pure, deterministic engine of ES modules with no DOM. It runs in both Node and the browser.
- **Demo UI (`demo/`):** a static UI in plain HTML/JS. It calls `analyseer(scenario)` and renders the result.
- **No build step.** `scripts/serve.mjs` serves the demo locally with the engine mounted at `/engine/`. For the artifact, the same files are published at those same paths.

**Tech Stack:**
- Node 22 with `node:test` and `node:assert/strict`, and no npm dependencies.
- Vanilla JS (ES modules) and inline SVG.
- Playwright with the pre-installed Chromium for E2E. Use `require('playwright')`; do NOT run `playwright install`.

**Spec:** `docs/superpowers/specs/2026-11-01-rollnest-demo-design.md`. Read it. Section numbers below (§4.2 etc.) refer to it.

## Global Constraints

- Units: input lengths in **cm**. Stof `rollengte` is in **m** (convert ×100 inside the engine). Output is m¹, m² and €, rounded to 2 decimals **only in the UI**. The engine returns unrounded numbers.
- UI language is Dutch. Identifiers in the engine use the Dutch domain terms of the spec (`stof`, `doek`, `bak`, `stuk`, `rolbreedte`, …).
- The engine is deterministic: no `Math.random`, no `Date.now()` in engine code. Randomness comes only from `engine/random.js` with an explicit seed.
- Floating-point comparisons in fit checks use `EPS = 1e-9`. Exact fits (piece width == roll width) must fit.
- No external runtime libraries in the demo. Fonts are allowed only from Google Fonts, and are optional.
- Fictional sample data only: no real brands. The company is "Zonwering Voorbeeld BV".
- The demo stores data only in `localStorage`, with try/catch around every access. Nothing is sent over the network.
- Branch `claude/rollnest-demo`. Commit after every task. Commit messages end with the session's attribution lines.

## Review Focus

1. **Stof/product referenced with different case or whitespace** (`" screen 5% antraciet"`). The user expects it to match the catalogue code or name case-insensitively after trimming. Only a truly unknown name gives a warning. → test in Task 2.
2. **Empty or partial scenarios:** no open orders, no history, or a stof without any orders. The user expects zeros and an empty-state message, never `NaN`, `Infinity` or a crash. → tests in Tasks 5, 6, 7 and 8.
3. **Numbers in Dutch Excel formats:** `"250,5"`, `"1.250"`, `"1.250,5"`, and quoted fields containing the separator. The user expects them parsed as 250.5, 1250 and 1250.5. → test in Task 1.
4. **Boundary fits:** a piece exactly as wide as the roll, a piece wider than a narrow reststuk, and speling pushing a piece just over the edge. The user expects an exact fit to be placed, and a too-wide piece to skip that bak rather than overflow it. → tests in Task 3 and Task 4.
5. **Corrupt or old saved state:** invalid JSON in `localStorage`, `versie` ≠ 1, or storage throwing. The user expects the demo to load the sample data and keep working. → test in Task 9.

---

## File Structure

```
package.json                 type:module, scripts.test = "node --test tests/"
prototype/index.html         old prototype, moved unchanged (git mv)
engine/random.js             mulberry32(seed) PRNG (shared by sample data + tests)
engine/csv.js                parseOrdersCSV
engine/catalogus.js          zoekStof / zoekProduct (case-insensitive lookup)
engine/snijmaat.js           maakStukken: order lines → doeken + stukken
engine/packers.js            single-bin Guillotine + MaxRects
engine/nesting.js            nestStof: multi-bin, 8 strategies, pick best
engine/verbruik.js           berekenVerbruik
engine/normen.js             maatklasse, berekenNormen
engine/inkoop.js             berekenInkoop
engine/index.js              analyseer (only public entry for the UI)
demo/voorbeelddata.js        voorbeeldScenario()
demo/opslag.js               laadScenario / bewaarScenario (storage-agnostic)
demo/format.js               nl number formatting, esc(), naarCSV()
demo/snijplan-svg.js         snijplanSVG(bak, opties) → string
demo/ui-orders.js            Orders screen
demo/ui-stoffen.js           Stoffen & regels screen
demo/ui-resultaat.js         Resultaat screen (4 subtabs) + header KPIs
demo/app.js                  state, debounce, tab routing, wiring
demo/index.html              markup + CSS (tokens, light/dark, print)
scripts/serve.mjs            static server: / → demo/, /engine/ → engine/
tests/*.test.js              one file per engine/demo module
tests/e2e.mjs                Playwright smoke run + screenshots
```

**Import paths:** demo modules import the engine as `./engine/index.js`, never with `../`. `serve.mjs` maps `/engine/*` to `engine/`, and the artifact publish uses the published path `engine/*.js`. Tests import `../engine/x.js` and `../demo/x.js` directly. Demo modules that tests import (`opslag.js`, `format.js`, `snijplan-svg.js`, `voorbeelddata.js`) must therefore not import the engine; they are pure.

## Shared Types (engine)

These are referenced by name in the tasks below. Lengths are in cm unless noted otherwise.

```js
Orderregel  { orderNr, datum /*YYYY-MM-DD*/, product, stof, breedte, hoogte, aantal }
Waarschuwing{ soort: 'onbekendeStof'|'onbekendProduct'|'ongeldigeMaat'|'onplaatsbaar', orderNr, melding /*NL*/ }
Doek        { doekId, orderNr, datum, product /*code*/, stof /*code*/, breedte, hoogte, snijB, snijH, nettoM2 }
Stuk        { id, doekId, orderNr, product, stof, w /*over roll*/, h /*along roll*/, magDraaien, vastGedraaid, baan: {i,n}|null }
Plaatsing   { stukId, doekId, x, y, w, h, gedraaid }          // w,h = piece dims as placed, excluding speling
Bak         { id, soort: 'reststuk'|'rol'|'nieuw', voorraadId|null, breedte, lengte, plaatsingen: Plaatsing[], gebruikteLengte }
NestResultaat { bakken: Bak[], strategie: string, nieuweRollen: number, onplaatsbaar: Stuk[] }
```

IDs:
- `doekId = \`${regelIndex}:${orderNr}#${k}\`` with k = 1..aantal.
- `Stuk.id = \`${doekId}/${i}\`` with i = 1..n, and n = 1 when there are no banen.
- Bak ids: the voorraad id for stock items, and `nieuw-1`, `nieuw-2`, … for virtual rolls.

---

### Task 1: Project setup + CSV import

**Files:**
- Create: `package.json`, `engine/random.js`, `engine/csv.js`, `tests/csv.test.js`, `tests/random.test.js`
- Move: `index.html` → `prototype/index.html` (`git mv`)

**Interfaces:**
- Produces:
  - `mulberry32(seed: number) → () => number`, returning numbers in [0,1).
  - `parseGetal(tekst: string) → number | NaN`.
  - `parseOrdersCSV(tekst: string, vandaag: string /*YYYY-MM-DD*/) → { regels: Orderregel[], fouten: {regelNr, melding}[] }`.

- [ ] **Step 1: Setup.**
  - `git mv index.html prototype/index.html`.
  - Create `package.json` with `{"name":"rollnest","private":true,"type":"module","scripts":{"test":"node --test tests/","serve":"node scripts/serve.mjs","e2e":"node tests/e2e.mjs"}}`.
- [ ] **Step 2: Write failing tests**
  - `random.test.js`: the same seed gives the same first 5 values; values lie in [0,1); different seeds give different sequences.
  - `csv.test.js`:
    - `separator ;` — `"ordernr;datum;product;stof;breedte;hoogte;aantal\nA1;2026-11-02;screen;S5A;250;180;2"` → one row `{orderNr:'A1', breedte:250, hoogte:180, aantal:2, …}`.
    - `separator , and tab` — the same data with `,` and `\t` gives identical rows.
    - `aliases` — the header `Order,Date,Type,Artikel,B,H,Qty` maps to the same fields.
    - `defaults` — without `aantal`/`datum` columns: `aantal === 1` and `datum === vandaag`.
    - `getallen` — `parseGetal('250,5') === 250.5`, `parseGetal('1.250') === 1250`, `parseGetal('1.250,5') === 1250.5`, `parseGetal('250.5') === 250.5`, `parseGetal('abc')` is NaN.
    - `quoted field` — `"A1;\"Screen; extra\";…"` keeps `Screen; extra` as one field.
    - `foute regels` — non-numeric breedte, breedte ≤ 0, or a missing required column (`stof`, `breedte`, `hoogte`) → listed in `fouten` with a 1-based `regelNr` (header = 1) and a Dutch melding. Valid rows are still returned.
    - `empty input` → `{regels:[], fouten:[]}`.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement**
  - `parseGetal` rule: if the text contains both `.` and `,`, remove the dots and turn the comma into a decimal point. If it contains only `.` and that dot is followed by exactly 3 digits at the end (`/^\d{1,3}(\.\d{3})+$/`), treat the dots as thousands separators. Otherwise replace `,` with `.`.
  - Separator detection: pick whichever of `\t`, `;`, `,` occurs most often in the header line, in that preference order on ties.
  - Blank lines are skipped. `orderNr`, `product` and `stof` are trimmed strings.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(engine): CSV import + seeded PRNG; move prototype`.

### Task 2: Catalogue lookup + snijmaat

**Files:**
- Create: `engine/catalogus.js`, `engine/snijmaat.js`, `tests/snijmaat.test.js`

**Interfaces:**
- Consumes: `Orderregel`.
- Produces:
  - `zoekStof(stoffen, ref) → Stof|null` and `zoekProduct(producttypes, ref) → Producttype|null`. Both match `ref` trimmed and case-insensitively against `code` first, then `naam`.
  - `maakStukken(regels: Orderregel[], scenario) → { doeken: Doek[], stukken: Stuk[], waarschuwingen: Waarschuwing[] }`. Here `scenario` provides `stoffen`, `producttypes` and `instellingen`. `Doek.stof` and `Doek.product` hold the resolved **codes**.

- [ ] **Step 1: Write failing tests.** Fixture: stof `T` with rolbreedte 120, rollengte 40, draaien false; stof `R` with rolbreedte 320, rollengte 30, draaien true; product `knik` with toeslag B 6 / H 20; product `screen` with 4 / 12; naadtoeslag 4.
  - `toeslagen` — screen 200×150 on R → one stuk `{w:204, h:162, magDraaien:true, vastGedraaid:false, baan:null}`. The doek has `snijB 204, snijH 162, nettoM2 ≈ 3.3048`.
  - `aantal` — aantal 3 → 3 doeken with doekIds `0:A#1..0:A#3`.
  - `te breed, draaien mag` — knik 500×300 on R: snijB 506 > 320, snijH 320 ≤ 320 → one stuk `{w:320, h:506, magDraaien:false, vastGedraaid:true}`.
  - `banen` — knik 500×300 on T → 5 stukken, each `w ≈ 104.4, h:320, magDraaien:false, baan:{i:1..5, n:5}`. The doek's nettoM2 is the sum of the banen (5 × 104.4 × 320 / 10000).
  - `banen ook als draaien mag maar snijH te breed` — knik 500×400 on R (snijH 420 > 320) → banen with n = 2 and w = (506+4)/2 = 255.
  - `onplaatsbaar` — screen 100×4000 on R (h 4012 > 3000) → no stukken, and a waarschuwing of soort `onplaatsbaar`.
  - `lookup tolerant` — stof `' r '` resolves to `R`. An unknown stof gives soort `onbekendeStof` and an unknown product soort `onbekendProduct`; neither produces a doek. Breedte 0 gives `ongeldigeMaat`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.1.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): snijmaat with toeslagen, draaien en banen`.

### Task 3: Single-bin packers

**Files:**
- Create: `engine/packers.js`, `tests/packers.test.js`

**Interfaces:**
- Produces: `maakPacker(soort: 'guillotine'|'maxrects', breedte, lengte) → { plaats(w, h, magDraaien) → {x, y, w, h, gedraaid} | null }`. The `w` and `h` passed in already include speling. When `gedraaid`, the returned w/h are swapped. The packer only places pieces; it never reorders them.

- [ ] **Step 1: Write failing tests** (run every test for both soorten):
  - `drie naast elkaar` — bin 300×1000, plaats(100,200,false) ×3 → all at y=0, x ∈ {0,100,200}.
  - `exact fit` — bin 250×1000, plaats(250,100,false) is not null.
  - `te breed` — bin 120×1000, plaats(121,10,false) is null; plaats(121,10,true) gives `gedraaid:true, w:10, h:121`.
  - `te lang` — bin 300×100, plaats(10,101,false) is null.
  - `invarianten` — seed 1..20 with mulberry32: 40 random pieces (w 20–150, h 20–300, magDraaien random) into a 300×3000 bin. Every returned placement lies within the bin (EPS) and no two placements overlap (area of intersection > EPS fails).
  - `maxrects bottom-left` — bin 300×1000: place 200×100, then 200×50. The second goes to y=100 (it does not fit beside the first because 200+200 > 300), and x=0.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - **Guillotine** keeps a list of free rects. To place a piece, pick the free rect with the smallest `rect.area − w·h` (best area fit); on ties, the lower y, then the lower x. Then split the remainder along the shorter leftover axis (SAS).
  - **MaxRects** keeps maximal free rects. Pick the candidate with the lowest `y`, then the lowest `x`. After each placement, split every intersecting free rect, then prune contained rects.
  - In both packers, when `magDraaien` is set, try both orientations and keep the better score.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): guillotine + maxrects packers`.

### Task 4: Multi-bin nesting per stof

**Files:**
- Create: `engine/nesting.js`, `tests/nesting.test.js`

**Interfaces:**
- Consumes: `maakPacker` (Task 3), `Stuk` (Task 2).
- Produces:
  - `STRATEGIEEN`: an array of 8 names in this order: `guillotine/oppervlak`, `guillotine/lengte`, `guillotine/breedte`, `guillotine/langsteZijde`, then the same four for `maxrects/…`.
  - `nestStof(stukken: Stuk[], stof: Stof, voorraad: VoorraadItem[], instellingen) → NestResultaat`.
    - `voorraad` contains only this stof's items.
    - `bakken` contains **all** stock bakken, empty ones included, plus the virtual rolls that were used.
    - `gebruikteLengte = max(y+h)` over the placements, and 0 when the bak is empty.
- [ ] **Step 1: Write failing tests.** Stof `R` 320 cm × 30 m with draaien true, stof `T` 120 × 40 with draaien false.
  - `bakvolgorde` — voorraad = [reststuk 320×300 `rs1`, reststuk 320×150 `rs2`, rol 320×3000 `r1`], one stuk 100×100. It lands in `rs2` (the shortest reststuk first).
  - `reststuk te smal` — reststuk 80×500, stuk 100×100 with magDraaien false. It is not placed in the reststuk; it goes to the next bak.
  - `voorraad voor nieuw` — rol `r1` exists → `nieuweRollen === 0`. With no voorraad → `nieuweRollen === 1` and the bak id is `nieuw-1`.
  - `nieuwe rol bij vol` — 11 stukken of 320×300 on R with no voorraad → `nieuweRollen === 2` (10 fit per 3000 cm).
  - `geen draaien` — stof T, a stuk with magDraaien false and w 110, h 200 → `gedraaid === false` for every placement.
  - `speling` — snijspeling 2, roll 320 wide, two stukken 159×100 with magDraaien false. Speling is added to both w and h of every stuk (161 + 161 = 322 > 320), so they stack: assert that their y-positions differ. Without speling (0), they sit side by side at y=0.
  - `deterministisch` — same input twice → deep-equal results.
  - `kiest beste` — `strategie` is one of `STRATEGIEEN`. The result's total `gebruikteLengte` is ≤ that of every individual strategy (export `nestMetStrategie(stukken, stof, voorraad, instellingen, naam)` for this test).
  - `invarianten` — for 20 seeded random sets (30–80 stukken) on R with a random voorraad: every stuk is placed exactly once, nothing overlaps within a bak, everything is inside its bak, and no stuk with `magDraaien:false` is placed with `gedraaid:true`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.2.
  - Sort keys, all descending: oppervlak = w·h; lengte = h; breedte = w; langsteZijde = max(w,h). Ties break on `id` ascending, which keeps the sort deterministic.
  - Placement: put each stuk in the first bak where `plaats` succeeds. If no bak fits, open `nieuw-k`. If even a fresh roll fails, the stuk goes into `onplaatsbaar`.
  - Selection: the lowest `nieuweRollen`, then the lowest Σ `gebruikteLengte`, then the earliest index in `STRATEGIEEN`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): multi-bin nesting met 8 strategieën`.

### Task 5: Verbruik

**Files:**
- Create: `engine/verbruik.js`, `tests/verbruik.test.js`

**Interfaces:**
- Consumes: `NestResultaat`, `Doek[]`.
- Produces: `berekenVerbruik(nest: NestResultaat, doeken: Doek[], stof: Stof, instellingen) → { perBak: [{bakId, brutoLengte, brutoM2, nettoM2, verliesM2, restLengte, restIsVerlies}], totaal: {brutoM1, brutoM2, nettoM2, verliesM2, verliesfactor}, doeken: [{doekId, orderNr, product, stof, nettoM2, aandeel, brutoM2, m1}] }`.
  - `perBak` covers only bakken that have placements.
  - `doeken` covers only the doeken that have at least one placed stuk in this nest.

- [ ] **Step 1: Write failing tests** (build the `NestResultaat` fixtures by hand):
  - `restlengte verlies` — bak of length 300 with gebruikteLengte 270 and minReststukLengte 50 → `restLengte 30, restIsVerlies true, brutoLengte 300`.
  - `restlengte voorraad` — gebruikteLengte 200 → `restIsVerlies false, brutoLengte 200`.
  - `m2` — bak 320 wide with brutoLengte 200 → brutoM2 6.4. Two placed stukken of 100×200 → nettoM2 4, verliesM2 2.4.
  - `verdeling` — two doeken with netto 3 and 1 m² and stof bruto 6 → brutoM2 4.5 and 1.5, and m1 = brutoM2 / 3.2. The sum of doeken.brutoM2 equals totaal.brutoM2 (within 1e-9). A doek with 2 banen counts both banen.
  - `verliesfactor` — totaal.brutoM2 / nettoM2, and ≥ 1 in the random invariant run of Task 4's generator piped through `nestStof`.
  - `leeg` — an empty nest gives all totals 0, verliesfactor 1 and `doeken: []`, with no NaN anywhere (check with `JSON.stringify(result).includes('NaN')` false and `Number.isFinite` on the totals).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.3. `brutoM1 = Σ brutoLengte / 100`. For a reststuk narrower than the rolbreedte, use the bak's own breedte for the m².
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): verbruik, restlengte-regel en verdeling per doek`.

### Task 6: Normen from history

**Files:**
- Create: `engine/normen.js`, `tests/normen.test.js`

**Interfaces:**
- Consumes: `maakStukken`, `nestStof`, `berekenVerbruik`.
- Produces:
  - `maatklasse(breedte) → '<150'|'150-249'|'250-349'|'>=350'`.
  - `berekenNormen(scenario) → { normen: Norm[], maandverbruik: {[stofCode]: {maand, brutoM1}[]}, verwachtPerMaand: {[stofCode]: number}, waarschuwingen: Waarschuwing[] }`, with `Norm = {stof, product, maatklasse, aantalDoeken, gemNettoM2, gemM1, verliesfactor}`.
  - The function uses `scenario.historie`. Each month × stof group is nested with `voorraad = []`.
  - `maandverbruik[stof]` lists **every** month from the first to the last history month (global, across all stoffen), in ascending order, with 0 for months without orders. Every stof in the catalogue gets an entry.
- [ ] **Step 1: Write failing tests.**
  - `maatklasse` — 149 → `<150`, 150 → `150-249`, 249 → `150-249`, 250 → `250-349`, 350 → `>=350`.
  - `maandgroepering` — history in 2026-01 and 2026-03 only → months `2026-01, 2026-02, 2026-03`, with 2026-02 at 0.
  - `venster` — historieMaanden 3, monthly bruto 30, 0, 60 m¹ → verwacht 30. With historieMaanden 2 → (0+60)/2 = 30. With historieMaanden 5 but only 3 months of data → the average is over the 3 available months, which is 30. Decision: the window is clamped to the available months.
  - `norm` — 4 screens of the same size in one month → one Norm with `aantalDoeken 4`; `gemM1` equals the per-doek m1 average; `verliesfactor` equals the stof's Σbruto/Σnetto over all history.
  - `leeg` — empty history → `normen: []`, `maandverbruik[stof] = []` and `verwachtPerMaand[stof] = 0` for every stof.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.4.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): verbruiksnormen en verwacht maandverbruik`.

### Task 7: Inkoopadvies

**Files:**
- Create: `engine/inkoop.js`, `tests/inkoop.test.js`

**Interfaces:**
- Consumes: `NestResultaat`, the `totaal` and `doeken` from `berekenVerbruik`.
- Produces: `berekenInkoop({ stof, nest, verbruik, verwachtPerMaand /*m¹*/, gevoelM1 /*number|undefined*/, instellingen }) → InkoopRegel`.
  - `InkoopRegel = { stof, hardBrutoM1, nieuweRollenHard, restVoorraadM1, verwachtM1, extraM1, teBestellenRollen, teBestellenM1, kosten, gevoelM1, gevoelBron:'eigen'|'toeslag', verschilM1, verschilEuro }`. All lengths are in m.

- [ ] **Step 1: Write failing tests.** Hand-calculated example: stof R 320 cm × 30 m at €17/m¹, minReststukLengte 50, gevoelToeslag 15.
  - `voorraad dekt alles` — nest with bak `r1` (rol, lengte 3000, gebruikteLengte 1200) and no new rolls; netto open 30 m²; verbruik.totaal.brutoM1 12; horizon 0. Expected: `hardBrutoM1 12, nieuweRollenHard 0, restVoorraadM1 18, verwachtM1 0, extraM1 0, teBestellenRollen 0, kosten 0`.
  - `horizon` — the same, with horizonMaanden 1 and verwachtPerMaand 25 → `verwachtM1 25, extraM1 7, teBestellenRollen 1, teBestellenM1 30, kosten 510`.
  - `nieuwe rollen` — nest with `nieuw-1` (gebruikteLengte 2000) and no voorraad, horizon 0 → `nieuweRollenHard 1, restVoorraadM1 10, teBestellenRollen 1`.
  - `kleine rest telt niet` — a rol with restlengte 40 cm (< 50) → contributes 0 to restVoorraadM1.
  - `reststukken tellen niet voor prognose` — an unused reststuk of 320×400 → restVoorraadM1 unchanged.
  - `gevoel toeslag` — netto 30 m² → gevoelM1 = 30 × 1.15 / 3.2 = 10.78125; `gevoelBron 'toeslag'`; verschilM1 = gevoelM1 − hardBrutoM1; verschilEuro = verschilM1 × 17.
  - `gevoel eigen` — gevoelM1 20 → `gevoelBron 'eigen'`, verschilM1 = 20 − 12 = 8, verschilEuro 136.
  - `geen orders` — empty nest and verbruik → every field is finite; the hard values are 0; gevoelM1 is 0 (toeslag) unless an own value was given.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.5. Netto open m² comes from `verbruik.totaal.nettoM2`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): inkoopadvies en vergelijking met gevoel`.

### Task 8: `analyseer` + sample data + benchmark

**Files:**
- Create: `engine/index.js`, `demo/voorbeelddata.js`, `tests/analyseer.test.js`, `tests/voorbeelddata.test.js`

**Interfaces:**
- Consumes: everything in Tasks 1–7.
- Produces:
  - `analyseer(scenario) → Resultaat`, where `Resultaat = { waarschuwingen, perStof: {[code]: {stof, snijplan: NestResultaat, verbruik, inkoop: InkoopRegel}}, doeken: DoekVerbruik[] /*all stoffen, open orders*/, normen, maandverbruik, totalen: {kosten, gevoelEuro, berekendEuro, verschilEuro, verschilPct, verliesfactor} }`.
    - `berekendEuro = Σ hardBrutoM1 × prijs`.
    - `gevoelEuro = Σ gevoelM1 × prijs`.
    - `verschilPct = berekendEuro > 0 ? verschilEuro / berekendEuro × 100 : 0`.
    - `verliesfactor = Σ brutoM2 / Σ nettoM2` over the open orders, and 1 when there are none.
    - `perStof` has a key for every stof in the catalogue.
  - `engine/index.js` also re-exports `parseOrdersCSV`, `maatklasse` and `STRATEGIEEN`.
  - `voorbeeldScenario() → Scenario`. It returns a fresh object every call (deep-equal across calls), generated with `mulberry32(2026)`. Use the exact stoffen, producttypes and toeslagen of spec §5.2, codes `S5A, S3W, VDG, RLZ, ZSB` and `screen, rolgordijn, knikarm, uitval`, and the standard instellingen of spec §3.
    - Open orders: 60 rows dated 2026-11-02..2026-11-13.
    - History: 2025-11..2026-10, with 30–90 rows per month and the peak in 2026-03..2026-06.
    - Voorraad: per stof 0–2 rollen, some of them partially used, plus 4–6 reststukken in total.
    - Realistic ranges: screen B 80–400 × H 100–300; rolgordijn B 50–250 × H 80–280; knikarm B 200–600 × uitval 150–350 (only on ZSB and VDG); uitval B 80–300 × H 100–250 (ZSB).
- [ ] **Step 1: Write failing tests.**
  - `voorbeelddata.test.js`: deterministic; 5 stoffen and 4 producttypes; 60 open orders; 12 history months, each with 30–90 rows; at least one knikarm on ZSB wider than 480 (so banen occur); no row references an unknown code.
  - `analyseer.test.js`:
    - `voorbeeld ijkpunt` — `totalen.verschilPct` lies between 5 and 20 inclusive. If this fails, tune the sample data (not the engine) until it passes.
    - `consistent` — for every stof, `inkoop.teBestellenM1 === inkoop.teBestellenRollen × rollengte`, and the doeken `m1` sum matches the stof's `verbruik.totaal.brutoM1` within 1e-6.
    - `leeg scenario` — `analyseer({...voorbeeldScenario(), openOrders: [], historie: []})` → no NaN in `JSON.stringify(result)`, and `totalen.kosten === 0`.
    - `waarschuwingen doorgegeven` — an extra open order with stof `XXX` → one waarschuwing with soort `onbekendeStof`.
    - `snelheid` — `analyseer(voorbeeldScenario())` takes < 2000 ms (performance.now).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `analyseer`: maakStukken on the open orders, then per stof nestStof (with that stof's voorraad) → berekenVerbruik → berekenInkoop (with `berekenNormen(...).verwachtPerMaand`), then aggregate. Then implement `voorbeeldScenario`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: analyseer() en voorbeelddata Zonwering Voorbeeld BV`.

### Task 9: Demo shell — server, opslag, format, Orders & Stoffen screens

**Files:**
- Create: `scripts/serve.mjs`, `demo/index.html`, `demo/app.js`, `demo/opslag.js`, `demo/format.js`, `demo/ui-orders.js`, `demo/ui-stoffen.js`, `tests/opslag.test.js`, `tests/format.test.js`

**Interfaces:**
- Consumes: `analyseer`, `parseOrdersCSV` from `./engine/index.js`; `voorbeeldScenario` from `./voorbeelddata.js`.
- Produces:
  - `opslag.js`:
    - `SLEUTEL = 'rollnest-scenario-v1'`.
    - `laadScenario(storage, fallback: () => Scenario) → Scenario`, which returns the fallback when the stored value is missing, contains invalid JSON, has `versie !== 1`, or when `getItem` throws.
    - `bewaarScenario(storage, scenario) → boolean`, which never throws.
  - `format.js`:
    - `getal(n, dec = 2) → string` in nl-NL format (`1.234,50`).
    - `euro(n) → '€ 1.234,50'`.
    - `esc(s) → string` (HTML escape `& < > " '`).
    - `naarCSV(kolommen: {kop, waarde: row => any}[], rijen) → string`, with `;` as separator, decimal comma, and fields containing `;`, `"` or a newline quoted.
  - `ui-orders.js`: `renderOrders(el, state, acties)`. `ui-stoffen.js`: `renderStoffen(el, state, acties)`. `acties` is the object of `app.js` with methods `wijzig(pad, waarde)`, `vervang(sleutel, waarde)`, `herbereken()`.
  - `app.js` keeps `state = { scenario, resultaat, tab, subtab, ordersTab }`. Every change goes through `wijzig`/`vervang`, which save and schedule `analyseer` with a 300 ms debounce, then re-render the active screen and the header KPIs.
  - **DOM hooks** used by E2E:
    - main tabs: `[data-tab="orders"|"stoffen"|"resultaat"]`
    - buttons: `#btn-voorbeeld`, `#btn-leeg`
    - import: `#import-tekst` (textarea), `#import-bestand` (file input), `#btn-import`, `#import-fouten`
    - orders tables: `#tabel-open`, `#tabel-historie`, with `[data-orders-tab="open"|"historie"]`
    - scenario: `#btn-export-scenario`, `#btn-import-scenario`
    - header KPIs: `#kop-kosten`, `#kop-verschil`, `#kop-verlies`
- [ ] **Step 1: Write failing tests**
  - `opslag.test.js` uses a fake storage object:
    - missing value → fallback;
    - `'{bad'` → fallback;
    - `{"versie":2}` → fallback;
    - `getItem` throws → fallback;
    - a round trip of bewaar then laad gives a deep-equal result;
    - a `setItem` that throws makes `bewaarScenario` return false.
  - `format.test.js`:
    - `getal(1234.5) === '1.234,50'` and `getal(-3, 0) === '-3'` (implement with `Intl.NumberFormat('nl-NL')`);
    - `euro(510) === '€ 510,00'` (normalize the NBSP that Intl emits to a regular space);
    - `esc('<a href="x">&\'')` is fully escaped;
    - `naarCSV` output for a value `'a;b'` and the number 2.5 is `kop\n"a;b"` and `2,5` respectively.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `opslag.js` and `format.js`. Run `npm test`. Expected: PASS.
- [ ] **Step 4: Implement** `scripts/serve.mjs`: `node:http` on `PORT` (default 8080), serving `/` → `demo/index.html`, `/engine/*` → `engine/*` and other paths → `demo/*`, with content types for html/js/css/svg/json and 404 otherwise. Path traversal is rejected (the resolved path must stay inside the mapped directory).
- [ ] **Step 5: Implement** `demo/index.html`, `app.js`, `ui-orders.js` and `ui-stoffen.js`.
  - **Layout:** a header with the logo "RollNest", the three KPI tiles and the main tabs; the screen content below.
  - **CSS:** tokens on `:root` for the colours, with dark mode via `@media (prefers-color-scheme: dark)` under `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`, plus a theme toggle. `body` gets an explicit background. Wide tables sit in `.tabel-scroll { overflow-x: auto }`, there is a 16 px side gutter on mobile, and the page never scrolls horizontally.
  - **Orders screen:** the open/historie toggle; an editable table (one input per cell and a delete button per row; "Regel toevoegen"); the import panel with textarea plus file input, which shows `parseOrdersCSV` results (number of rows, and errors in `#import-fouten`) and appends them on `#btn-import` to the active list.
  - **Stoffen screen:** editable tables for stoffen, producttypes and voorraad; the instellingen form (naadtoeslag, snijspeling, minReststukLengte, gevoelToeslag, historieMaanden, horizonMaanden as a select of 0/1/3); and per stof the field "Wat zou je zelf bestellen (m¹)", which writes to `scenario.gevoel[code]` and is left empty when not filled in.
  - **Notice:** a line reading "Alle gegevens blijven in je browser — er wordt niets verstuurd."
  - **Startup:** `laadScenario(localStorage, voorbeeldScenario)`. Guard against `localStorage` being undefined or throwing by passing a no-op storage.
- [ ] **Step 6: Manual check.** Run `npm run serve`, then load the page with Playwright (headless): no console errors, the KPI tiles show numbers, and editing a breedte changes `#kop-kosten` within 1 s. A throwaway script in the scratchpad is fine; Task 11 adds the permanent E2E.
- [ ] **Step 7: Commit** `feat(demo): app shell, opslag, orders- en stoffenscherm`.

### Task 10: Resultaat screen

**Files:**
- Create: `demo/ui-resultaat.js`, `demo/snijplan-svg.js`, `tests/snijplan-svg.test.js`
- Modify: `demo/app.js` (route the `resultaat` tab), `demo/index.html` (styles and print CSS)

**Interfaces:**
- Consumes: `Resultaat` (Task 8); `getal`, `euro`, `esc` and `naarCSV` (Task 9).
- Produces:
  - `snijplanSVG(bak: Bak, { kleurVoor: doekId => css, label: plaatsing => string }) → string`.
    - The viewBox is `0 0 breedte gebruikteLengte'`, where `gebruikteLengte'` is the bak's gebruikteLengte plus the restlengte when `restIsVerlies`.
    - It draws one `<rect class="stuk">` per plaatsing, a hatched `<rect class="verlies">` background (an SVG pattern) and a `<text>` label per stuk showing orderNr and w×h.
    - The roll width runs horizontally and the length vertically, scaled to fit its container through `width="100%"`.
  - `renderResultaat(el, state, acties)` with subtabs `[data-subtab="inkoop"|"doeken"|"normen"|"snijplannen"]`, and export buttons `#btn-export-inkoop-csv`, `#btn-export-doeken-csv` and `#btn-print-werkbon`.
- [ ] **Step 1: Write failing test** `snijplan-svg.test.js`: a bak with 3 plaatsingen → the output contains exactly 3 `class="stuk"`, one `class="verlies"`, the viewBox `0 0 320 200`, and the labels HTML-escaped (an orderNr `<x>` appears as `&lt;x&gt;`).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement `snijplanSVG`. Run `npm test`. Expected: PASS.
- [ ] **Step 3: Implement** `renderResultaat`:
  - **inkoop (default):** a table per stof with harde behoefte m¹, verwacht m¹, voorraad over m¹, te bestellen (rollen and m¹), kosten, gevoel m¹ (with a mark showing "eigen" or "+15%") and verschil €. The verschil gets a green or red text label (`te veel` / `te weinig`), not colour alone. Each row has a horizontal bar comparing gevoel with berekend. A footer row holds the totals. Below the table: the waarschuwingen list, if there are any.
  - **doeken:** a filter by stof and product (selects) and a table with orderNr, product, stof, ordermaat, snijmaat, netto m², bruto m² and m¹.
  - **normen:** the norm table, grouped by stof; then the monthly consumption per stof as an inline SVG bar chart (one chart per stof, 12 bars, labelled months, values in m¹ on hover via `<title>`).
  - **snijplannen:** a stof select. Per bak: a heading with the soort (Reststuk/Voorraadrol/Nieuwe rol), the dimensions, gebruikt m¹, the verlies % and the strategie, followed by `snijplanSVG`. Doeken get colours from a fixed palette of 8 tokens, indexed by doek order.
  - **Werkbon:** `#btn-print-werkbon` sets `body.print-werkbon` and calls `window.print()`. The print CSS hides navigation and KPIs and prints the snijplannen of the selected stof together with the doeken list.
  - **CSV:** download via a Blob plus a temporary `<a download>`. The filenames are `inkoopadvies.csv` and `verbruik-per-doek.csv`.
  - **Empty states:** "Nog geen open orders — laad de voorbeelddata of importeer een CSV."
- [ ] **Step 4: Manual check** with the same throwaway Playwright approach: every subtab renders, there are no console errors and the SVGs are visible.
- [ ] **Step 5: Commit** `feat(demo): resultaatscherm met inkoopadvies, verbruik, normen en snijplannen`.

### Task 11: E2E, README, publish

**Files:**
- Create: `tests/e2e.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: the DOM hooks of Tasks 9–10 and `scripts/serve.mjs`.

- [ ] **Step 1: Write** `tests/e2e.mjs`. It starts `serve.mjs` on port 8765 as a child process, then uses `require('playwright')` through `createRequire`:
  1. Open `/`, click `#btn-voorbeeld`, wait 1 s, and assert that `#kop-kosten` contains `€`.
  2. Visit each main tab and each resultaat subtab.
  3. Assert ≥ 1 `svg rect.stuk` on snijplannen.
  4. Paste `"ordernr;stof;product;breedte;hoogte\nE2E;S5A;screen;200;150"` into `#import-tekst` on the open orders tab, click `#btn-import`, and assert that `#tabel-open` contains `E2E`.
  5. Assert that no `console.error` and no `pageerror` occurred.
  6. Take screenshots at 1280×800 and 390×844 into `$SCRATCH` (an env var, defaulting to `./e2e-screens/`, which is git-ignored), and assert `document.documentElement.scrollWidth <= innerWidth` on mobile.

  It exits non-zero on failure and kills the server in `finally`.
- [ ] **Step 2: Run** `npm run e2e`. Expected: it ends with `E2E OK`. Fix any failures in the owning module.
- [ ] **Step 3: README.md.** Rewrite it in Dutch:
  - the purpose (scherper inkopen through nesting);
  - the demo link (filled in after publishing);
  - running it locally (`npm run serve`), the tests (`npm test`, `npm run e2e`) and the CSV format (spec §4.7);
  - the repo layout;
  - a note that `prototype/` holds the old prototype.
- [ ] **Step 4: Run** `npm test && npm run e2e`. Expected: both PASS.
- [ ] **Step 5: Commit** `test: e2e smoke + README` and push `git push -u origin claude/rollnest-demo`.
- [ ] **Step 6: Publish the artifact** (the controller does this, not a subagent).
  - Load the `artifact-design` skill first and apply the page contract (title "RollNest demo", tokens and theming are already in place).
  - Publish `demo/index.html` with `files` mapping `app.js`, `opslag.js`, `format.js`, `ui-*.js`, `snijplan-svg.js` and `voorbeelddata.js` from `demo/`, and `engine/*.js` from `engine/` at the published paths `engine/<name>.js`. Use icon `chart`.
  - Open the published URL with Playwright if it is reachable, or else rely on the E2E result. Add the link to the README and commit and push.

---

## Spec coverage check

| Spec | Task |
|---|---|
| §3 data model / instellingen | 2, 8 (defaults), 9 (form) |
| §4.1 snijmaat | 2 |
| §4.2 nesting | 3, 4 |
| §4.3 verbruik | 5 |
| §4.4 normen | 6 |
| §4.5 inkoop | 7 |
| §4.6 analyseer | 8 |
| §4.7 csv | 1 |
| §5.1 screens | 9, 10 |
| §5.2 sample data + ijkpunt | 8 |
| §5.3 opslag / scenario export | 9 |
| §5.4 design / mobile | 9, 10, 11 |
| §6 repo layout | 1, 9, 11 |
| §7 tests incl. performance + E2E | 1–8, 11 |
| §8 acceptance | 11 |
