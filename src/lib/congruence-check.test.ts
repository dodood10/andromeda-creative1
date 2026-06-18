import { describe, expect, it } from "vitest";
import { heuristicCongruenceCheck } from "./congruence-check";
import type { OfferSnapshot } from "./offer-snapshot";

const offer: OfferSnapshot = {
  promessa: "Método para emagrecer 8kg em 30 dias com acompanhamento nutricional",
  mecanismo: "Protocolo de jejum intermitente personalizado com suporte diário",
  cta: "Comece seu teste grátis de 7 dias",
  formato_produto: "curso online",
  nicho_inferido: "emagrecimento",
};

describe("congruence-check", () => {
  it("score alto quando hook ecoa a oferta", () => {
    const result = heuristicCongruenceCheck({
      offerSnapshot: offer,
      hook: "Emagrecer com protocolo nutricional personalizado em 30 dias",
      cta: "Comece seu teste grátis",
      pageText: offer.promessa,
    });
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("score baixo quando hook é de outro nicho", () => {
    const result = heuristicCongruenceCheck({
      offerSnapshot: offer,
      hook: "Minha glicemia caiu de 230 para 102 com canela e pepino",
      cta: "Assista o vídeo",
      pageText: offer.promessa,
    });
    expect(result.score).toBeLessThan(70);
    expect(result.divergencias.length).toBeGreaterThan(0);
  });
});
