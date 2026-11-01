import { zoekStof, zoekProduct, draaienVan, geldigeStof } from './catalogus.js';
import { nl } from './tekst.js';

const EPS = 1e-9;

// Orderregels → doeken en stukken (spec 4.1). Snijspeling telt mee in elke past-beslissing:
// een stuk plus speling moet in de rolbreedte passen, anders draait of splitst het (of past het niet).
export function maakStukken(regels, scenario) {
  const doeken = [];
  const stukken = [];
  const waarschuwingen = [];
  const naad = scenario.instellingen?.naadtoeslag ?? 0;
  const s = scenario.instellingen?.snijspeling ?? 0;

  regels.forEach((regel, regelIndex) => {
    const { orderNr } = regel;
    const warn = (soort, melding) => waarschuwingen.push({ soort, orderNr, regelIndex, melding });
    const stof = zoekStof(scenario.stoffen, regel.stof);
    if (!stof) return warn('onbekendeStof', `Order ${orderNr}: onbekende stof "${regel.stof}".`);
    if (!geldigeStof(stof)) return warn('ongeldigeStof', `Order ${orderNr}: stof ${stof.naam || stof.code} heeft geen geldige rolbreedte, rollengte of prijs; vul die in bij Stoffen.`);
    const product = zoekProduct(scenario.producttypes, regel.product);
    if (!product) return warn('onbekendProduct', `Order ${orderNr}: onbekend producttype "${regel.product}".`);
    const { breedte, hoogte, aantal } = regel;
    if (!(breedte > 0) || !(hoogte > 0) || !(aantal > 0)) {
      return warn('ongeldigeMaat', `Order ${orderNr}: ongeldige maat of aantal (${nl(breedte)} x ${nl(hoogte)}, aantal ${nl(aantal)}).`);
    }

    const snijB = breedte + product.toeslagBreedte;
    const snijH = hoogte + product.toeslagHoogte;
    const rb = stof.rolbreedte;
    const maxLengte = stof.rollengte * 100;
    const draaien = draaienVan(stof);
    const past = (w) => w + s <= rb + EPS;

    // Vorm van de stukken van één doek (zonder ids).
    let vormen;
    if (past(snijB)) {
      vormen = [{ w: snijB, h: snijH, magDraaien: draaien === 'vrij', vastGedraaid: false, baan: null }];
    } else if (draaien !== 'nooit' && past(snijH)) {
      vormen = [{ w: snijH, h: snijB, magDraaien: false, vastGedraaid: true, baan: null }];
    } else if (product.banenToegestaan === false) {
      return warn('onplaatsbaar', `Order ${orderNr}: doek van ${nl(snijB)} cm is te breed voor ${stof.naam || stof.code} (rol ${nl(rb)} cm); kies een bredere stof.`);
    } else {
      let n = 2;
      while (!past((snijB + (n - 1) * naad) / n)) {
        n++;
        if (n > 1000 || naad + s >= rb) { n = 0; break; }
      }
      if (n === 0) {
        return warn('onplaatsbaar', `Order ${orderNr}: doek van ${nl(snijB)} cm breed past niet in banen op een rol van ${nl(rb)} cm.`);
      }
      const w = (snijB + (n - 1) * naad) / n;
      vormen = Array.from({ length: n }, (_, k) => ({ w, h: snijH, magDraaien: false, vastGedraaid: false, baan: { i: k + 1, n } }));
    }

    // Banen van één doek worden achter elkaar uit één rol gesneden: samen moeten ze erop passen.
    const lengte = vormen.reduce((t, v) => t + v.h + s, 0);
    if (lengte > maxLengte + EPS) {
      return warn('onplaatsbaar', vormen.length > 1
        ? `Order ${orderNr}: de ${vormen.length} banen van dit doek zijn samen ${nl(lengte)} cm lang en passen niet op één rol (${nl(maxLengte)} cm).`
        : `Order ${orderNr}: stuk van ${nl(vormen[0].h)} cm is langer dan de rol (${nl(maxLengte)} cm).`);
    }

    for (let k = 1; k <= aantal; k++) {
      const doekId = `${regelIndex}:${orderNr}#${k}`;
      doeken.push({
        doekId, orderNr, datum: regel.datum, product: product.code, stof: stof.code,
        breedte, hoogte, snijB, snijH, nettoM2: vormen.reduce((t, v) => t + (v.w * v.h) / 10000, 0),
      });
      vormen.forEach((v, i) => stukken.push({
        id: `${doekId}/${i + 1}`, doekId, orderNr, product: product.code, stof: stof.code, ...v,
      }));
    }
  });

  return { doeken, stukken, waarschuwingen };
}
