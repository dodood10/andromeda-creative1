import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_ENTRIES,
  capReferenceTranscriptions,
  formatReferenceTranscriptionsBlock,
  mergeReferenceTranscription,
  type ReferenceTranscription,
} from "./project-reference-intel";

const sampleRef: ReferenceTranscription = {
  id: "a1",
  text: "Você já tentou de tudo para emagrecer e nada funcionou? Esse método mudou a vida de milhares de mulheres.",
  added_at: "2026-06-18T12:00:00.000Z",
};

describe("inteligência geral vs campeão (vídeo)", () => {
  it("cenário 1: transcrição colada gera bloco de inteligência geral", () => {
    const block = formatReferenceTranscriptionsBlock([sampleRef]);
    expect(block).toContain("REFERÊNCIAS DE COPY");
    expect(block).toContain("podem ser de outros nichos");
    expect(block).toContain("emagrecer");
  });

  it("bloco de referência exige adaptação à oferta", () => {
    const block = formatReferenceTranscriptionsBlock([sampleRef]);
    expect(block).toContain("PADRÃO ESTRUTURAL APENAS");
  });

  it("transcrição com análise prioriza hook no prompt", () => {
    const withAnalysis: ReferenceTranscription = {
      ...sampleRef,
      analysis: {
        hook: "Você já tentou de tudo?",
        angulo: "Depoimento emagrecimento",
        tipo_angulo: "Escala · depoimento",
        estrutura_resumo: "hook → mecanismo → CTA",
        formato_inferido: "UGC",
        nivel_conspiracao: "sem",
      },
    };
    const block = formatReferenceTranscriptionsBlock([withAnalysis]);
    expect(block).toContain("Hook: Você já tentou de tudo?");
  });

  it("cenário 2: sem transcrições, inteligência geral é null (performance fica separada)", () => {
    expect(formatReferenceTranscriptionsBlock([])).toBeNull();
    expect(formatReferenceTranscriptionsBlock(undefined)).toBeNull();
  });

  it("merge adiciona transcrição à biblioteca org", () => {
    const merged = mergeReferenceTranscription({}, sampleRef);
    expect(merged.reference_transcriptions).toHaveLength(1);
  });

  it("cenário 4: import campeão não escreve em reference_transcriptions", () => {
    const importSrc = readFileSync(
      resolve(import.meta.dirname, "import-creative.functions.ts"),
      "utf8",
    );
    const perfSrc = readFileSync(
      resolve(import.meta.dirname, "project-performance-context.ts"),
      "utf8",
    );
    expect(importSrc).not.toContain("reference_transcriptions");
    expect(perfSrc).not.toContain("formatReferenceTranscriptionsBlock");
  });

  it(`cap mantém no máximo ${MAX_REFERENCE_ENTRIES} transcrições`, () => {
    const many = Array.from({ length: 35 }, (_, i) => ({
      id: `id-${i}`,
      text: `Copy campeã número ${i} com texto suficiente para validar o limite de armazenamento.`,
      added_at: new Date().toISOString(),
    }));
    expect(capReferenceTranscriptions(many)).toHaveLength(MAX_REFERENCE_ENTRIES);
    expect(capReferenceTranscriptions(many)[0]?.id).toBe("id-5");
  });
});
