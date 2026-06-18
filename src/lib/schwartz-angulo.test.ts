import { describe, expect, it } from "vitest";
import {
  computeFourUsScore,
  goalToSchwartzRange,
  inferAnguloCopyFromText,
  pickFunnelSchwartzPackage,
  parseNivelConscienciaAlvo,
} from "./schwartz-angulo";
import type { ResultadoAngulos } from "./schemas/angulos.schema";

function mockAngulo(
  i: number,
  nivel: 1 | 2 | 3 | 4 | 5,
  copy: import("./types/enums").AnguloCopyTipo,
): ResultadoAngulos["angulos"][0] {
  return {
    numero: i + 1,
    nome: `Angulo ${i}`,
    tipo: "Escala",
    micropersona: { nome: `MP ${i}`, papel_temido: "teste" },
    variavel_explorada: "var",
    angulo_copy: copy,
    nivel_consciencia_alvo: nivel,
    nivel_schwartz: String(nivel),
    nivel_conspiracao: "sem",
    hook: "Hook específico com método X e resultado 23% em 30 dias",
    estrutura: [{ tempo: "0-3s", conteudo: "hook" }],
    hook_visual: "",
    cta: "Comece agora",
    justificativa_probabilistica: "",
    sinais_andromeda: {
      hook_rate_estimado: "40%",
      feedback_negativo_esperado: "baixo",
      fatia_leilao: "media",
    },
    saturacao_hook: { status: "neutro", observacao: "" },
    janela_relevancia: { tipo: "media", estimativa: "", motivo: "" },
  };
}

describe("schwartz-angulo", () => {
  it("mapeia goal traf para níveis 1-2", () => {
    const r = goalToSchwartzRange("traf");
    expect(r.min).toBe(1);
    expect(r.max).toBe(2);
  });

  it("infere angulo_copy contrario", () => {
    expect(inferAnguloCopyFromText("Mito ou verdade: diabéticos não podem comer carboidrato")).toBe(
      "contrario",
    );
  });

  it("parse nivel consciencia de string", () => {
    expect(parseNivelConscienciaAlvo("3 — consciente da solução")).toBe(3);
  });

  it("pickFunnelSchwartzPackage seleciona um por nível", () => {
    const resultado: ResultadoAngulos = {
      diagnostico: {
        mecanismo: "m",
        nivel_consciencia: "3",
        sofisticacao_mercado: "intermediario",
        variavel_oportunidade: "v",
      },
      angulos: [
        mockAngulo(0, 1, "curiosidade"),
        mockAngulo(1, 2, "problema_solucao"),
        mockAngulo(2, 3, "novo_mecanismo"),
        mockAngulo(3, 4, "autoridade_prova"),
        mockAngulo(4, 5, "direto"),
      ],
    };
    const picks = pickFunnelSchwartzPackage(resultado);
    expect(picks).toHaveLength(5);
    expect(new Set(picks).size).toBe(5);
  });

  it("4 U's penaliza hook genérico", () => {
    const weak = computeFourUsScore("Transforme sua vida com resultados incríveis", "Saiba mais");
    const strong = computeFourUsScore(
      "Minha glicemia caiu de 230 para 102 com o protocolo MetaboFix",
      "Garanta sua vaga",
      "conv",
    );
    expect(strong.score).toBeGreaterThan(weak.score);
  });
});
