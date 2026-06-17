## Objetivo

Evoluir o gerador com as 5 melhorias propostas: pergunta cirúrgica gerada pela IA (etapa 0), calibração de tom aplicada por bloco, nível de conspiração no output, alerta de saturação do hook e janela de relevância por ângulo.

## 1. Etapa 0 — Pergunta cirúrgica gerada pela IA

Hoje o campo `perguntaCirurgica` é preenchido livremente pelo usuário. Vamos transformar em fluxo de duas etapas no gerador:

- **Nova server function `gerarPerguntaCirurgica`** em `src/lib/anthropic.functions.ts`:
  - Input: `url`, `productType`, `goal`, `context`.
  - Usa Claude (sem `web_search`, mais barato/rápido) com um system prompt curto que recebe regras por tipo de produto:
    - `ecom` → "qual é a principal objeção que impede a compra"
    - `info` → "qual transformação o cliente mais cita ao recomendar"
    - `saas` → "qual workflow manual o avatar faz hoje que o produto elimina"
    - `ticket` → "qual decisão grande está travada esperando esse serviço"
    - `saude` → "qual solução o avatar já tentou e por que falhou"
  - Retorna `{ pergunta: string, justificativa: string }` em JSON.

- **UI no `app.gerador.tsx`**:
  - Botão principal vira **"Gerar pergunta cirúrgica"** quando ainda não há pergunta.
  - Ao receber resposta, mostra card destacado com a pergunta + textarea para o usuário responder + botão **"Gerar 5 ângulos"**.
  - O campo livre de pergunta cirúrgica atual vira só a resposta (label muda para "Sua resposta").
  - Adicionar botão pequeno "Pular e gerar direto" para usuários experientes.

## 2. Calibração de tom aplicada bloco a bloco

No `SYSTEM_PROMPT` do `gerarAngulos`, adicionar bloco novo **REGRAS DE CALIBRAÇÃO DE TOM POR BLOCO**:

- Hook (0-3s): sempre linguagem exata da micropersona, ignora calibração escolhida.
- Agitação da dor (3-10s): aplica a calibração no máximo da intensidade escolhida.
- Mecanismo (10-20s): sempre técnico/preciso, ignora calibração.
- Prova/consequência (20-30s): aplica calibração escolhida no nível médio.
- CTA (30-45s): sempre direto, ignora calibração.

Sem mudanças no schema — apenas reforço de instrução para Claude gerar o `conteudo` de cada bloco respeitando essas regras.

## 3. Nível de conspiração no output

Adicionar ao schema de cada ângulo:

```ts
nivel_conspiracao: "sem" | "leve" | "forte"
// "sem" = foco em mecanismo científico
// "leve" = "a indústria não quer que você saiba"
// "forte" = big pharma / governo / convencional escondendo
```

- No `SYSTEM_PROMPT`: instruir que para nichos onde conspiração é variável fixa (saúde, emagrecimento, finanças) o nível precisa estar coerente com o que escala no nicho; para outros nichos pode ser `"sem"`.
- Na UI: badge inline no header de cada ângulo (cor sutil) ao lado do badge de tipo, e linha no grid de metadados.

## 4. Alerta de saturação do hook

Adicionar ao schema de cada ângulo:

```ts
saturacao_hook: {
  status: "saturado" | "neutro" | "sub_explorado",
  observacao: string  // por que está nesse estado segundo a pesquisa de mercado
}
```

- No `SYSTEM_PROMPT`: na etapa 2 (pesquisa via web_search), a IA já mapeia hooks saturando — agora deve devolver explicitamente esse sinal por ângulo.
- Na UI: ícone + badge colorido (vermelho saturado, neutro cinza, verde sub_explorado) dentro do card "Sinais Andromeda esperados", com tooltip mostrando a observação.

## 5. Janela de relevância

Adicionar ao schema de cada ângulo:

```ts
janela_relevancia: {
  tipo: "atemporal" | "media" | "curta",
  estimativa: string,  // ex: "60-90 dias antes de saturar no nicho"
  motivo: string       // por que essa janela
}
```

- No `SYSTEM_PROMPT`: instrução para classificar (ângulos de mecanismo único e objeção invertida tendem a atemporal; tendência/sazonal tendem a curta).
- Na UI: pequena seção "Janela de relevância" abaixo dos sinais Andromeda, com ícone de relógio, badge do tipo e texto da estimativa/motivo.

## Arquivos a editar

- `src/lib/anthropic.functions.ts`
  - Adicionar `gerarPerguntaCirurgica` (nova server fn) e o tipo de retorno.
  - Atualizar `SYSTEM_PROMPT` do `gerarAngulos` com: regras de calibração por bloco, exigência de `nivel_conspiracao`, `saturacao_hook`, `janela_relevancia`.
  - Atualizar `ResultadoAngulos` com os três novos campos por ângulo.

- `src/routes/app.gerador.tsx`
  - Estado novo: `pergunta` (objeto vindo da etapa 0), `etapa` ("input" | "respondendo" | "resultado").
  - Card de pergunta cirúrgica gerada (etapa intermediária) com textarea de resposta e dois CTAs (Gerar ângulos / Pular).
  - Renderizar `nivel_conspiracao`, `saturacao_hook` e `janela_relevancia` em cada `AccordionItem`.

## Sem mudança em

- Modelo continua `claude-sonnet-4-5` + `web_search_20250305`.
- Secrets já configurados (`ANTHROPIC_API_KEY`).
- Demais rotas e infra.

## Validação

Rodar uma geração end-to-end no preview com uma URL real, conferir no console que o JSON volta com `nivel_conspiracao`, `saturacao_hook`, `janela_relevancia` populados, e que o fluxo de pergunta cirúrgica funciona (geração → resposta → ângulos).
