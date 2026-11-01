# RollNest

RollNest helpt zonweringbedrijven scherper stof inkopen. De demo zet orders om in koopadvies door de doeken echt te nesten op de rollen, in plaats van met een vuistregel (bijvoorbeeld "bestel 15% extra") te werken.

Live demo: (link volgt)

## Wat de demo laat zien

- **Inkoopadvies:** per stof de harde behoefte uit open orders, het verwachte verbruik, de voorraad, het aantal te bestellen rollen en de kosten. Naast elkaar met wat je op gevoel zou bestellen.
- **Vergelijking met de vuistregel:** de kopcijfers tonen het verschil in euro's en procenten.
- **Verbruik per doek:** hoeveel stof elk doek kost, inclusief verlies, met filter op stof en product.
- **Normen:** het verbruik per maatklasse en het maandverbruik per stof, afgeleid uit de historie.
- **Snijplannen en werkbon:** per rol een tekening van de indeling, en een werkbon per stof voor de snijafdeling.

Let op: met de realistische voorbeelddata koopt de vuistregel van 15% ongeveer 5% te weinig in, omdat het echte verlies rond de 22% ligt. Dat is een voorbeeld, geen belofte. Het resultaat hangt af van je eigen ordermix: maten, stoffen en of een stof gedraaid mag worden.

## Lokaal draaien

```
npm run serve
```

Open daarna http://localhost:8080. Er zijn geen dependencies om te installeren.

## Testen

```
npm test       # unittests van de rekenkern en demo-onderdelen (node:test)
npm run e2e    # Playwright-rooktest met screenshots in e2e-screens/ (of $SCRATCH)
```

De e2e-test gebruikt een lokaal geïnstalleerde Playwright met Chromium.

## CSV-formaat

Plak regels in het orders-scherm of kies een bestand. Het scheidingsteken (`;`, `,` of tab) wordt automatisch herkend, een decimale komma mag. Maten zijn in cm.

| Kolom | Aliassen |
|---|---|
| ordernr | order, ordernummer |
| datum | date |
| product | producttype, type |
| stof | artikel, doek |
| breedte | b, width |
| hoogte | h, lengte, height |
| aantal | qty, stuks |

Kolomnamen zijn niet hoofdlettergevoelig. Ontbreekt `aantal`, dan geldt 1. Ontbreekt `datum`, dan geldt vandaag. Foute regels worden niet geïmporteerd maar wel getoond.

```
ordernr;datum;product;stof;breedte;hoogte;aantal
1001;2026-10-12;screen;S5A;200;150;2
1002;2026-10-13;rolgordijn;RLZ;120,5;180;1
```

## Indeling van de repo

```
engine/       rekenkern: csv, snijmaat, nesting, verbruik, normen, inkoop, voorbeelddata, index.js
demo/         de demo: index.html, app.js en de schermen (ui-*.js)
scripts/      serve.mjs, een kleine lokale server
tests/        *.test.js en e2e.mjs
docs/         ontwerpspecificatie en plannen
prototype/    het oude prototype (ongewijzigd bewaard)
```

## Privacy

Alles gebeurt lokaal in de browser. Er worden geen gegevens naar een server gestuurd. Het scenario wordt alleen in de localStorage van je eigen browser bewaard.
