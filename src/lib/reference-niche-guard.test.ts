import { describe, expect, it } from "vitest";
import { compareWithProjectNicho, detectNicheSignals } from "./reference-niche-guard";

describe("reference-niche-guard", () => {
  it("detecta sinais de diabetes", () => {
    expect(detectNicheSignals("Minha glicemia caiu de 230 para 102")).toContain("diabetes");
  });

  it("avisa mismatch diabetes vs projeto emagrecimento", () => {
    const result = compareWithProjectNicho(
      "emagrecimento",
      "Ritual com canela para diabéticos tipo 2 reduzir glicemia",
    );
    expect(result.mismatch).toBe(true);
    expect(result.message).toMatch(/estrutura/i);
  });

  it("sem aviso quando nichos compatíveis", () => {
    const result = compareWithProjectNicho(
      "emagrecimento",
      "Perca peso com este método de metabolismo acelerado",
    );
    expect(result.mismatch).toBe(false);
  });
});
