import { describe, expect, it } from "vitest";
import {
  CHAMPION_STRUCTURE_SNIPPET,
  extractChampionSnippetsFromText,
  isLikelyLessonTranscript,
} from "./reference-transcription-extract";
import {
  formatReferenceComboBlock,
  formatReferenceTranscriptionsBlock,
  type ReferenceTranscription,
} from "./project-reference-intel";

const LESSON_SAMPLE = `
Galera, beleza? Nessa aula vamos ver passo a passo na planilha os top 10 da biblioteca de anúncios.
Um anúncio que escala muito usa este hook: Minha glicemia caiu imediatamente de 230 para 102 depois que eu fiz isso.
De longe a melhor técnica do mundo para reduzir açúcar no sangue.
Olá, meu nome é Olivia, sou ex diabética tipo 2 e descobri um ritual com pepino, canela e folha chinesa antes de dormir.
Outro formato vencedor: misturar banana com água gera efeito bariátrico em 20 segundos no estômago.
Vamos lá analisar formato UGC versus notícia na planilha.
`.repeat(3);

describe("reference-transcription-extract", () => {
  it("detecta texto de aula longa", () => {
    expect(isLikelyLessonTranscript(LESSON_SAMPLE)).toBe(true);
    expect(isLikelyLessonTranscript("Minha glicemia caiu de 230 para 102. Assista o vídeo.")).toBe(
      false,
    );
  });

  it("extrai trechos de copy campeã e template estrutural", () => {
    const { snippets, isLesson } = extractChampionSnippetsFromText(LESSON_SAMPLE);
    expect(isLesson).toBe(true);
    expect(snippets.length).toBeGreaterThanOrEqual(3);
    expect(snippets.some((s) => /230|102|glicemia/i.test(s.text))).toBe(true);
    expect(snippets.some((s) => s.label === CHAMPION_STRUCTURE_SNIPPET.label)).toBe(true);
  });
});

describe("reference combo no prompt", () => {
  const refs: ReferenceTranscription[] = [
    {
      id: "s1",
      text: "estrutura longa",
      added_at: "2026-06-18T12:00:00.000Z",
      label: "Estrutura",
      analysis: {
        hook: "hook A",
        angulo: "Ang A",
        tipo_angulo: "Escala",
        estrutura_resumo: "mecanismo → invalida → causa → VSL",
        formato_inferido: "UGC",
        nivel_conspiracao: "leve",
      },
    },
    {
      id: "f1",
      text: "formato",
      added_at: "2026-06-18T12:01:00.000Z",
      label: "Formato notícia",
      analysis: {
        hook: "hook B",
        angulo: "Ang B",
        tipo_angulo: "Previsibilidade",
        estrutura_resumo: "notícia chocante",
        formato_inferido: "notícia · talking head",
        nivel_conspiracao: "sem",
      },
    },
  ];

  it("monta bloco de combo ativo", () => {
    const block = formatReferenceComboBlock(refs, {
      structure_id: "s1",
      formato_id: "f1",
    });
    expect(block).toContain("COMBO DE REFERÊNCIAS ATIVO");
    expect(block).toContain("mecanismo → invalida");
    expect(block).toContain("notícia");
  });

  it("inclui combo antes das referências no bloco geral", () => {
    const block = formatReferenceTranscriptionsBlock(refs, 5, 600, {
      structure_id: "s1",
      angulo_id: "f1",
    });
    expect(block?.indexOf("COMBO")).toBeLessThan(block?.indexOf("REFERÊNCIAS") ?? 0);
  });
});
