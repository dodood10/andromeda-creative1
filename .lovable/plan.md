## Objetivo

Substituir o system prompt do gerador pelo novo (metodologia Andromeda 2026 completa) e expandir o output JSON + UI para refletir toda a riqueza estratégica do novo prompt (diagnóstico ampliado, micropersona, variável explorada, sinais Andromeda, justificativa probabilística, etc.).

## Mudanças

### 1. `src/lib/anthropic.functions.ts`
- Substituir `SYSTEM_PROMPT` pelo prompt completo enviado pelo usuário (identidade + 9 modelos mentais + processo + formato + regras).
- Adicionar ao `InputSchema` os novos campos opcionais: `perguntaCirurgica` (string) e `tomCalibracao` (`"direto" | "empatico" | "autoritativo"`).
- Aumentar `max_tokens` para 8192 (output muito mais denso) e `max_uses` do web_search para 8.
- Expandir o JSON pedido na instrução final do system prompt para o schema abaixo, e atualizar o tipo de retorno do handler:

```ts
{
  diagnostico: {
    mecanismo: string;
    nivel_consciencia: string;          // Schwartz + justificativa
    sofisticacao_mercado: "novo" | "intermediario" | "sofisticado";
    variavel_oportunidade: string;      // o que competidores não exploram + porquê
  },
  angulos: [{
    numero: number;
    nome: string;
    tipo: "Previsibilidade" | "Escala" | "Orgânico";
    micropersona: { nome: string; papel_temido: string };
    variavel_explorada: string;
    nivel_schwartz: string;
    hook: string;                       // 0-3s, texto exato
    estrutura: [
      { tempo: "0-3s",   conteudo: string },
      { tempo: "3-10s",  conteudo: string },
      { tempo: "10-20s", conteudo: string },
      { tempo: "20-30s", conteudo: string },
      { tempo: "30-45s", conteudo: string }
    ],
    hook_visual: string;
    cta: string;
    justificativa_probabilistica: string;
    sinais_andromeda: {
      hook_rate_estimado: string;
      feedback_negativo_esperado: "baixo" | "medio" | "alto";
      fatia_leilao: string;
    }
  }]  // sempre 5, cada um para uma micropersona diferente
}
```

- Reforçar no prompt: "Responda APENAS com JSON válido, sem markdown, sem texto antes/depois".

### 2. `src/routes/app.gerador.tsx`
- Adicionar dois novos controles no card de input:
  - `Input` "Pergunta cirúrgica respondida" (opcional, textarea curto).
  - `Select` "Calibração de tom": Direto e agressivo / Empático e suave / Autoritativo e técnico.
- Passar `perguntaCirurgica` e `tomCalibracao` para o `run({ data: ... })`.
- Atualizar o card de **Diagnóstico** para 4 campos novos (Mecanismo, Nível de consciência, Sofisticação, Variável de maior oportunidade).
- Atualizar cada `AccordionItem` para exibir:
  - Header: nome do ângulo + badge de tipo + linha de micropersona.
  - Conteúdo: grid com Micropersona/Papel temido, Variável explorada, Nível Schwartz, Hook visual.
  - Bloco "Hook (0-3s)" destacado.
  - Estrutura bloco a bloco (já existe, mantém).
  - Bloco "CTA" destacado.
  - Bloco "Justificativa probabilística".
  - Bloco "Sinais Andromeda esperados" (hook rate, feedback negativo com cor semântica, fatia de leilão).
- Manter botões "Refinar com IA" e "Abrir no editor".

### 3. Sem mudanças em
- `start.ts`, infra, secrets (`ANTHROPIC_API_KEY` já configurada).
- Modelo continua `claude-sonnet-4-5` com `web_search_20250305`.

## Validação
- Rodar uma geração de teste no preview com uma URL real e verificar no console que o JSON volta com todos os novos campos; ajustar parse se Claude embrulhar em ```json.
