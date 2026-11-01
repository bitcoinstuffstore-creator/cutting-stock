# RollNest demo — ontwerp (spec)

*Datum: 2026-11-01 · Status: ter review*

## 1. Doel en context

RollNest wordt een SaaS-product voor **zonweringsbedrijven** (tweede doelgroep: textiel/confectie). Het einddoel is **scherper inkopen van stof**. Daarvoor moet je weten wat het werkelijke verbruik per stof en per doek is, en dat verbruik bepalen we door te **nesten**: de doeken optimaal op de rol indelen.

Op dit moment wordt ingekocht op gevoel, een beetje historie en de orders die binnenkomen.

Deze spec beschrijft de **eerste mijlpaal: een werkende demo als artifact**, een webpagina met een deelbare link. Daarmee halen we feedback op bij 3–5 potentiële klanten voordat we het volledige SaaS-product bouwen. De rekenkern bouwen we zo dat hij ongewijzigd mee kan naar dat SaaS-product.

**Kernboodschap van de demo:** "Je kocht X% / €Y te veel (of te weinig) in. Dit is wat je werkelijk nodig hebt, onderbouwd met een snijplan."

### Wat de demo laat zien

1. **Inkoopadvies per stof:** de harde behoefte (de genestte open orders) plus de verwachte behoefte (uit de historie), min de voorraad, afgerond op hele rollen, met de kosten.
2. **De vergelijking met "gevoel":** een vaste verliestoeslag of de eigen inschatting van de gebruiker, tegenover het berekende verbruik.
3. **Verbruik per doek:** netto m², bruto m² en m¹ inclusief toegerekend verlies.
4. **Verbruiksnormen** per stof × producttype × maatklasse, afgeleid uit de historie.
5. **Snijplannen per rol** als visuele onderbouwing, een printbare werkbon en CSV-exports.

### Bewust buiten scope (komt in het SaaS-ontwerp)

Inloggen, meerdere gebruikers en klantomgevingen, een server en database, een API, betalingen, DXF-export, labels en barcodes, het met de hand verschuiven van stukken (drag & drop), seizoenspatronen in de prognose, levertijden en minimale bestelhoeveelheden per leverancier, optimalisatie over meerdere stoffen tegelijk, en patroonaansluiting (rapport).

## 2. Begrippen en eenheden

- **Doek:** één te snijden product uit een orderregel. Een regel met `aantal = 3` levert 3 doeken op.
- **Ordermaat:** de breedte × hoogte van het eindproduct, in cm.
- **Snijmaat:** de ordermaat plus de confectietoeslagen, in cm.
- **Stuk:** een rechthoek die op de rol wordt geplaatst. Meestal is één doek één stuk; een doek met banen bestaat uit meerdere stukken.
- **Rolrichting:** de lengte van de rol. Standaard loopt de **hoogte** van het doek langs de rol en ligt de **breedte** van het doek over de rolbreedte. Bij draaien worden die twee verwisseld.
- **m¹:** strekkende meter rol, over de volle rolbreedte. **m²:** oppervlak.
- **Netto:** het oppervlak van de snijmaten. **Bruto:** het gebruikte roloppervlak, inclusief verlies.
- **Invoer** gaat in cm. **Uitvoer** is in m¹, m² en €, op 2 decimalen. Intern rekent de kern met cm, kommagetallen toegestaan.

## 3. Datamodel (het scenario)

Alle invoer zit in één JSON-object, het **scenario**. Dat is ook het formaat voor exporteren en importeren.

```js
{
  versie: 1,
  stoffen: [ { code, naam, rolbreedte /*cm*/, rollengte /*m*/, prijsPerM1 /*€*/, draaien: 'nooit' | 'alsTeBreed' | 'vrij' } ],
  // (oude scenario's met draaienToegestaan: true/false worden 'vrij'/'nooit')
  producttypes: [ { code, naam, toeslagBreedte /*cm*/, toeslagHoogte /*cm*/, banenToegestaan /*bool: screen en rolgordijn false*/ } ],
  openOrders: [ Orderregel ],
  historie:   [ Orderregel ],
  voorraad: [ { id, stof /*code*/, soort: 'rol' | 'reststuk', breedte /*cm*/, lengte /*cm*/ } ],
  gevoel: { [stofCode]: m1 /*optioneel: wat de gebruiker zelf zou bestellen*/ },
  instellingen: {
    naadtoeslag: 4,          // cm extra per naad, per baan aan de naadzijde verdeeld (zie 4.1)
    snijspeling: 0,          // cm ruimte tussen stukken
    minReststukLengte: 50,   // cm; een kortere restlengte telt als verlies
    gevoelToeslag: 15,       // % vaste verliestoeslag voor de "gevoel"-vergelijking
    historieMaanden: 3,      // venster voor de verwachte behoefte
    horizonMaanden: 1        // 0, 1 of 3: hoeveel maanden vooruit inkopen
  }
}
// Orderregel:
{ orderNr, datum /*YYYY-MM-DD*/, product /*producttype-code*/, stof /*stof-code*/, breedte /*cm*/, hoogte /*cm*/, aantal }
```

In de voorraad heeft een `rol` normaal de rolbreedte van zijn stof. Een `reststuk` kan smaller zijn.

## 4. Rekenkern

De kern bestaat uit pure functies in ES-modules, zonder DOM. Ze draaien zowel in de browser als in Node. Bij dezelfde invoer geven ze altijd dezelfde uitvoer (deterministisch, geen toeval).

### 4.1 `engine/snijmaat.js` — van ordermaat naar stukken

- `snijB = breedte + toeslagBreedte` en `snijH = hoogte + toeslagHoogte`, met de toeslagen van het producttype.
- Elke past-beslissing rekent met de snijspeling `s`: een stuk past over de rol als `w + s ≤ rolbreedte`.
- **Normaal:** het stuk is `snijB` over de rol en `snijH` langs de rol. Alleen bij `draaien: 'vrij'` mag de nesting het stuk later draaien.
- **Te breed voor de rol** (`snijB + s > rolbreedte`):
  - Als `draaien` 'alsTeBreed' of 'vrij' is en `snijH + s ≤ rolbreedte`, wordt het stuk vast gedraaid geplaatst: `snijH` over de rol en `snijB` langs de rol.
  - Staat het producttype geen banen toe (`banenToegestaan: false`, screens en rolgordijnen), dan is het doek **onplaatsbaar**: "te breed voor deze stof; kies een bredere stof".
  - In alle andere gevallen wordt het doek **in banen** gesplitst. Neem de kleinste `n ≥ 2` waarvoor `(snijB + (n−1)·naadtoeslag) / n ≤ rolbreedte`. Elke baan krijgt de breedte `(snijB + (n−1)·naadtoeslag) / n` en de lengte `snijH`.
  - Banen worden **niet** gedraaid, zodat de looprichting gelijk blijft binnen één doek. De nesting plaatst alle banen van één doek als één blok achter elkaar uit dezelfde bak (verfpartij, streeppatroon).
- **Te lang voor de rol:** een stuk dat langer is dan de rollengte wordt gemarkeerd als **onplaatsbaar** en komt in de waarschuwingen. Hetzelfde gebeurt bij een onbekende stof of producttype, of een maat ≤ 0.
- Elk stuk krijgt een verwijzing terug naar zijn doek: `{ doekId, orderNr, product, stof, w, h, magDraaien, baan: i/n }`.

### 4.2 `engine/nesting.js` — stukken op rollen plaatsen (per stof)

**Bakken.** Per stof is er een lijst bakken, met deze volgorde van voorrang:
1. reststukken van die stof, de kortste eerst;
2. voorraadrollen van die stof;
3. **virtuele nieuwe rollen** (rolbreedte × rollengte). Die worden pas aangemaakt als niets anders past.

**Plaatsen.** Per strategie wordt elk stuk in sorteervolgorde in de **eerste bak** gezet waarin het past. Draaien wordt alleen geprobeerd als `magDraaien` waar is. De snijspeling wordt opgeteld bij `w` en `h` van het stuk.

**Strategieën.** Er zijn 2 packers × 4 sorteervolgordes, dus 8 runs. De beste run wordt gekozen.

| Packer | Regel |
|---|---|
| **Guillotine** | Best area fit. Na elke plaatsing wordt de vrije ruimte gesplitst langs de kortste resterende as. Alle sneden lopen recht en volledig door, zoals op een snijtafel. |
| **MaxRects** | Bottom-left: de laagste positie langs de rol, bij gelijkstand de meest linkse. De vrije rechthoeken worden na elke plaatsing opgeschoond. |

De vier sorteervolgordes zijn: oppervlak aflopend, lengte langs de rol aflopend, breedte aflopend, en langste zijde aflopend.

**Keuze.** De beste run is die met het laagste aantal virtuele nieuwe rollen. Bij gelijkstand telt de laagste totale **bruto lengte** over alle bakken (zie 4.3). Bij een volledige gelijkstand wint de eerste strategie in de vaste volgorde.

**Uitvoer per bak:** de gebruikte lengte (de grootste `y + h`), alle plaatsingen `{ stukId, x, y, w, h, gedraaid }` en de strategie die gekozen is.

**Invarianten.** Deze worden met tests bewaakt:
- stukken overlappen nooit;
- elk stuk ligt binnen zijn bak;
- een stuk dat niet mag draaien wordt nooit gedraaid;
- elk plaatsbaar stuk wordt precies één keer geplaatst.

### 4.3 `engine/verbruik.js` — verlies, reststuk en verbruik per doek

**Per bak** (bakken zonder plaatsingen tellen niet mee):
- `bruto lengte = gebruikte lengte`.
- Als de **restlengte** (baklengte − gebruikte lengte) groter is dan 0 maar kleiner dan `minReststukLengte`, telt die restlengte **ook** mee als bruto. Dat stukje is te klein om te bewaren en dus verlies.
- Een restlengte van `minReststukLengte` of meer blijft voorraad: het blijft een rol of wordt een (kleiner) reststuk.
- `bruto m² = bruto lengte × bakbreedte`, `netto m² = Σ oppervlak van de geplaatste snijmaten`, `verlies m² = bruto − netto`.

**Per stof:** de som over de bakken. Daarbij hoort `verliesfactor = bruto m² / netto m²`.

**Per doek:** het verbruik wordt verdeeld naar verhouding van het oppervlak, binnen dezelfde stof en dezelfde run:
- `aandeel = netto m² van het doek / netto m² van de stof` (een doek met banen telt alle banen bij elkaar op);
- `bruto m² van het doek = aandeel × bruto m² van de stof`;
- `m¹ van het doek = bruto m² van het doek / (rolbreedte / 100)`.

Controle: de som van het verbruik over alle doeken is gelijk aan het totaal per stof (afwijking < 0,001).

### 4.4 `engine/normen.js` — verbruiksnormen uit de historie

- De historie wordt gegroepeerd per kalendermaand (`YYYY-MM`) × stof.
- Elke groep wordt **op virtuele nieuwe rollen** genest, dus zonder voorraad. Zo is de norm onafhankelijk van wat er toevallig op voorraad lag.
- **Maatklassen** op ordermaat-breedte: `< 150`, `150–249`, `250–349` en `≥ 350` cm.
- **Norm per stof × producttype × maatklasse:** het aantal doeken, de gemiddelde netto m² per doek, het gemiddelde m¹ per doek en de verliesfactor. De verliesfactor is die van de stof over de hele historie.
- **Maandverbruik per stof:** het bruto m¹ per maand.
- **Verwacht m¹ per maand per stof:** het gemiddelde van de laatste `historieMaanden` kalendermaanden, tot en met de laatste maand in de historie. Een maand zonder orders telt mee als 0.

### 4.5 `engine/inkoop.js` — inkoopadvies per stof

1. **Harde behoefte.** De open orders worden genest met voorrang voor de voorraad (4.2). Daaruit volgen:
   - `hardBruto m¹`: de totale bruto lengte van deze run, met de restlengte-regel uit 4.3;
   - `nieuweRollenHard`: het aantal virtuele nieuwe rollen dat nodig is.
2. **Resterende voorraad na de run** (`restVoorraad m¹`): de vrije restlengte van alle voorraadrollen, dus ook de rollen die niet zijn aangesproken, plus die van de virtuele nieuwe rollen. Die nieuwe rollen koop je toch al. Alleen restlengtes ≥ `minReststukLengte` tellen mee, en reststukken worden voor de prognose niet meegeteld.
3. **Verwachte behoefte** = `verwacht m¹ per maand × horizonMaanden`.
4. `extra m¹ = max(0, verwachte behoefte − restVoorraad m¹)`.
5. **Te bestellen rollen** = `nieuweRollenHard + ceil(extra m¹ / rollengte)`. Het bijbehorende aantal **m¹** = rollen × rollengte en de **kosten** = m¹ × prijsPerM1.
6. **Vergelijking met gevoel** (alleen over de harde behoefte, zodat het eerlijk blijft):
   - `gevoel m¹ = gevoel[stof]` als de gebruiker dat heeft ingevuld;
   - anders `netto m² van de open orders × (1 + gevoelToeslag/100) / (rolbreedte/100)`;
   - `verschil m¹ = gevoel m¹ − hardBruto m¹` en `verschil € = verschil m¹ × prijsPerM1`. Een positieve uitkomst betekent dat er met gevoel te veel zou worden ingekocht.
7. **Totalen** over alle stoffen: de kosten en het verschil met gevoel. Dat zijn de kopcijfers van de demo.

### 4.6 `engine/index.js` — hoofdfunctie

`analyseer(scenario) → resultaat`, met daarin `{ waarschuwingen, perStof: { snijplan, verbruik, inkoop }, doeken: [verbruik per doek], normen, maandverbruik, totalen }`. Dit is het enige punt waar de schermen de rekenkern aanroepen.

### 4.7 `engine/csv.js` — import

- Het scheidingsteken (`;`, `,` of tab, zodat plakken uit Excel ook werkt) wordt automatisch herkend. Een decimale komma wordt geaccepteerd.
- Kolomnamen worden zonder onderscheid tussen hoofd- en kleine letters herkend, inclusief aliassen:
  - `ordernr` / `order` / `ordernummer`
  - `datum` / `date`
  - `product` / `producttype` / `type`
  - `stof` / `artikel` / `doek`
  - `breedte` / `b` / `width`
  - `hoogte` / `h` / `lengte` / `height`
  - `aantal` / `qty` / `stuks`
- Ontbreekt `aantal`, dan geldt 1. Ontbreekt `datum`, dan geldt vandaag.
- Uitvoer: `{ regels, fouten: [{ regelNr, melding }] }`. Foute regels worden niet geïmporteerd maar wel getoond.

## 5. De demo (artifact)

### 5.1 Schermen

Bovenaan staan altijd de **kopcijfers**: de totale inkoopkosten voor de gekozen horizon, het verschil met gevoel in € en %, en de gemiddelde verliesfactor.

1. **Orders.** Twee tabbladen: *Open orders* en *Historie*.
   - Een tabel die je kunt bewerken (regel toevoegen en verwijderen), import van een CSV-bestand of geplakte tekst met een voorbeeld vooraf en de fouten erbij.
   - Knoppen: "Voorbeelddata laden" en "Leegmaken".
2. **Stoffen & regels.**
   - De stoffencatalogus, de producttypes met hun toeslagen en de voorraad, allemaal te bewerken.
   - De instellingen uit hoofdstuk 3, en per stof een optioneel veld "wat zou je zelf bestellen (m¹)".
3. **Resultaat.** Vier tabbladen:
   - **Inkoopadvies** (standaard open): per stof harde behoefte, verwacht, voorraad, te bestellen rollen, m¹, € en het verschil met gevoel, met een balkje gevoel ↔ berekend. Exporteerbaar als CSV.
   - **Verbruik per doek:** een tabel met filter op stof en product. Exporteerbaar als CSV.
   - **Normen:** de normtabel, plus een eenvoudig staafdiagram van het maandverbruik per stof.
   - **Snijplannen:** een SVG per rol (bak) met de doeken als gekleurde rechthoeken met ordernummer en maat, en het verlies gearceerd. Per stof is er een printbare werkbon via print-CSS.

De herberekening gebeurt automatisch bij elke wijziging, met een korte vertraging (debounce, ongeveer 300 ms).

### 5.2 Voorbeelddata (`demo/voorbeelddata.js`)

Een fictief bedrijf, *"Zonwering Voorbeeld BV"*, zonder echte merknamen.

**Stoffen:**

| Stof | Rol | Prijs | Draaien |
|---|---|---|---|
| Screen 5% Antraciet | 250 cm × 30 m | €14/m¹ | alleen als te breed |
| Screen 3% Wit | 320 cm × 30 m | €17/m¹ | alleen als te breed |
| Verduisterend Grijs | 300 cm × 40 m | €12/m¹ | vrij |
| Rolgordijn Linnen Zand | 200 cm × 50 m | €9/m¹ | nooit (structuur) |
| Zonneschermdoek Streep Blauw | 120 cm × 40 m | €11/m¹ | nooit (streep) |

**Producttypes:**

| Producttype | Toeslag breedte | Toeslag hoogte |
|---|---|---|
| Screen | +4 | +12 |
| Rolgordijn | +2 | +15 |
| Knikarmscherm | +6 | +20 |
| Uitvalscherm | +4 | +15 |

**Orders en voorraad:**
- Ongeveer **60 open orders** met realistische maten. Knikarmschermen tot 500 cm breed, waardoor bij het streepdoek banen ontstaan.
- **12 maanden historie** met een voorjaarspiek in maart–juni (circa 30–90 orderregels per maand).
- **Voorraad:** per stof 0–2 rollen, waarvan sommige deels gebruikt zijn, en een paar reststukken.

**Ijkpunt:** met de standaardinstellingen moet de demo een zichtbaar en geloofwaardig verschil met gevoel laten zien, ongeveer 5–20%.

### 5.3 Opslag en delen

- Het scenario wordt opgeslagen in `localStorage`, met try/catch om elke lees- en schrijfactie. Werkt dat niet, dan start de demo gewoon met de voorbeelddata.
- Met "Scenario exporteren/importeren" (JSON-bestand) kan een prospect zijn eigen data meenemen of opsturen.
- Er wordt niets naar een server gestuurd. Dat zetten we ook als verkoopargument in de demo.

### 5.4 Vormgeving

- Taal Nederlands. Een licht en een donker thema via CSS-variabelen.
- Bruikbaar op een telefoon, zonder horizontaal scrollen van de pagina. Brede tabellen scrollen binnen hun eigen kader.
- Geen externe libraries nodig. De diagrammen zijn eenvoudige inline SVG.

## 6. Repo-indeling

```
engine/        snijmaat.js nesting.js verbruik.js normen.js inkoop.js csv.js index.js
demo/          index.html app.js voorbeelddata.js (+ styles in index.html)
tests/         *.test.js (node:test, geen dependencies)
prototype/     index.html (het huidige prototype, ongewijzigd verplaatst)
docs/superpowers/specs/  deze spec
package.json   { "type": "module", "scripts": { "test": "node --test tests/" } }
```

- De demo importeert de rekenkern met relatieve ES-module-imports.
- Voor de artifact worden `demo/index.html` en de bijbehorende bestanden als multi-file artifact gepubliceerd.
- De README wordt bijgewerkt: doel, hoe je de demo opent en hoe je de tests draait.

## 7. Testen

**Unittests per module:**
- **snijmaat:** de toeslagen; het geval "te breed, draaien mag → gedraaid"; banen met de juiste breedte (bijvoorbeeld snijB 506, rol 120, naad 4 → n = 5, baan (506+16)/5 = 104,4); onplaatsbaar bij een stuk dat langer is dan de rol.
- **nesting:**
  - 3 stukken van 100 × 200 op een rol van 300 → één rij, gebruikte lengte 200.
  - Een stuk dat alleen gedraaid past, bij een stof die niet mag draaien → het wordt niet gedraaid en gaat naar een volgende bak of een nieuwe rol.
  - Reststukken worden gevuld vóór voorraadrollen, en voorraadrollen vóór nieuwe rollen.
  - Invariantentests (geen overlap, alles binnen de bak, alles precies één keer geplaatst) op willekeurig gegenereerde sets met een vaste seed.
- **verbruik:** de restlengte-regel; de som per doek is gelijk aan het totaal per stof; de verliesfactor is ≥ 1.
- **normen:** maandgroepering; een lege maand telt als 0 in het venster; de maatklassen.
- **inkoop:** een uitgewerkt voorbeeld met de hand nagerekend, met voorraad, horizon 0 en 1, het afronden op rollen en de berekening van gevoel.
- **csv:** de scheidingstekens `;`, `,` en tab; de decimale komma; aliassen; foute regels.

**Prestaties:** `analyseer()` moet met de voorbeelddata **binnen 2 s** klaar zijn in Node. Er komt een test die dat meet.

**End-to-end:** een Playwright-script (pre-installed Chromium) opent de demo, laadt de voorbeelddata, controleert dat de kopcijfers en alle tabbladen gevuld zijn en dat er geen fouten in de console staan, en maakt screenshots op desktop- en telefoonbreedte.

## 8. Acceptatiecriteria

1. `npm test` slaagt.
2. De demo is als artifact gepubliceerd en werkt meteen met de voorbeelddata.
3. Bij elke stof is het inkoopadvies met de hand na te rekenen uit de getoonde getallen: behoefte, voorraad, rollen en kosten.
4. Een eigen CSV in het formaat uit 4.7 importeren werkt, en eventuele fouten worden getoond.
5. Het snijplan laat geen overlap zien, en een stof die niet mag draaien wordt nooit gedraaid.
6. De code staat op de branch `claude/rollnest-demo` in de repo.
