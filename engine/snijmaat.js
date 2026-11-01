import { zoekStof, zoekProduct } from './catalogus.js';

const EPS = 1e-9;

export function maakStukken(regels, scenario) {
  const doeken = [];
  const stukken = [];
  const waarschuwingen = [];
  const naad = scenario.instellingen?.naadtoeslag ?? 0;
  const warn = (soort, orderNr, melding) => waarschuwingen.push({ soort, orderNr, melding });

  regels.forEach((regel, regelIndex) => {
    const { orderNr } = regel;
    const stof = zoekStof(scenario.stoffen, regel.stof);
    if (!stof) return warn('onbekendeStof', orderNr, `Order ${orderNr}: onbekende stof "${regel.stof}".`);
    const product = zoekProduct(scenario.producttypes, regel.product);
    if (!product) return warn('onbekendProduct', orderNr, `Order ${orderNr}: onbekend producttype "${regel.product}".`);
    const { breedte, hoogte, aantal } = regel;
    if (!(breedte > 0) || !(hoogte > 0) || !(aantal > 0)) {
      return warn('ongeldigeMaat', orderNr, `Order ${orderNr}: ongeldige maat of aantal (${breedte} x ${hoogte}, aantal ${aantal}).`);
    }

    const snijB = breedte + product.toeslagBreedte;
    const snijH = hoogte + product.toeslagHoogte;
    const rb = stof.rolbreedte;
    const maxLengte = stof.rollengte * 100;
    const draaien = !!stof.draaienToegestaan;

    // Vorm van de stukken van één doek (zonder ids).
    let vormen;
    if (snijB <= rb + EPS) {
      vormen = [{ w: snijB, h: snijH, magDraaien: draaien, vastGedraaid: false, baan: null }];
    } else if (draaien && snijH <= rb + EPS) {
      vormen = [{ w: snijH, h: snijB, magDraaien: false, vastGedraaid: true, baan: null }];
    } else {
      let n = 2;
      while ((snijB + (n - 1) * naad) / n > rb + EPS) {
        n++;
        if (n > 1000 || naad >= rb) { n = 0; break; }
      }
      if (n === 0) {
        return warn('onplaatsbaar', orderNr, `Order ${orderNr}: doek van ${snijB} cm breed past niet in banen op een rol van ${rb} cm.`);
      }
      const w = (snijB + (n - 1) * naad) / n;
      vormen = Array.from({ length: n }, (_, k) => ({ w, h: snijH, magDraaien: false, vastGedraaid: false, baan: { i: k + 1, n } }));
    }

    if (vormen.some((v) => v.h > maxLengte + EPS)) {
      return warn('onplaatsbaar', orderNr, `Order ${orderNr}: stuk van ${Math.max(...vormen.map((v) => v.h))} cm is langer dan de rol (${maxLengte} cm).`);
    }

    for (let k = 1; k <= aantal; k++) {
      const doekId = `${regelIndex}:${orderNr}#${k}`;
      doeken.push({
        doekId, orderNr, datum: regel.datum, product: product.code, stof: stof.code,
        breedte, hoogte, snijB, snijH, nettoM2: vormen.reduce((s, v) => s + (v.w * v.h) / 10000, 0),
      });
      vormen.forEach((v, i) => stukken.push({
        id: `${doekId}/${i + 1}`, doekId, orderNr, product: product.code, stof: stof.code, ...v,
      }));
    }
  });

  return { doeken, stukken, waarschuwingen };
}
