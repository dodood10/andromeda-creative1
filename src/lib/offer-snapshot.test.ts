import { describe, expect, it } from "vitest";
import { heuristicOfferSnapshot, formatOfferSnapshotBlock } from "./offer-snapshot";

describe("offer-snapshot", () => {
  it("extrai promessa heurística de texto de página", () => {
    const page =
      "Emagreça 8kg em 30 dias com nosso método comprovado. Garanta sua vaga agora.";
    const snap = heuristicOfferSnapshot(page);
    expect(snap.promessa).toContain("Emagreça");
    expect(snap.cta.toLowerCase()).toMatch(/garanta|emagreça/);
  });

  it("formata bloco canônico para o prompt", () => {
    const snap = heuristicOfferSnapshot("Curso de marketing digital para iniciantes.");
    const block = formatOfferSnapshotBlock(snap);
    expect(block).toContain("OFERTA CANÔNICA");
    expect(block).toContain("Nunca copie claims");
  });
});
