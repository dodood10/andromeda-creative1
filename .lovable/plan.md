# Corrigir erro "Anthropic 524"

## Diagnóstico
O 524 é um timeout da Cloudflare entre nosso servidor e a Anthropic — significa que a API demorou mais de ~100s para responder. Hoje em `src/lib/anthropic-json.ts` fazemos uma chamada POST não-streaming para `claude-sonnet-4-5` com `max_tokens: 8192` (e opcionalmente `web_search`), que frequentemente excede esse limite, especialmente em VSL, escala, congruence-check, offer-snapshot e import-creative.

## O que mudar

1. **Usar streaming na chamada Anthropic** (`src/lib/anthropic-json.ts`)
   - Adicionar `stream: true` no body.
   - Manter a conexão viva chunk-a-chunk (evita o 524 do edge).
   - Concatenar `content_block_delta` (`text_delta`) e retornar a mesma string final — assinatura pública de `callAnthropicJson` inalterada.

2. **Retry com backoff em erros transitórios**
   - Reexecutar até 2 vezes em caso de 524/529/502/503/timeout de rede.
   - Backoff curto (1s, 3s) para não bloquear a UX.

3. **Reduzir `max_tokens` padrão**
   - De 8192 → 4096 quando o caller não especificar.
   - Callers que precisam de mais (VSL longa) continuam passando explicitamente.

4. **Mensagem de erro amigável**
   - Em `src/lib/lovable-error-reporting.ts` (ou no toast do caller), traduzir "Anthropic 524" para "A IA demorou demais para responder. Tente novamente." em vez de expor o código bruto.

## Fora de escopo
- Sem trocar modelo (continua `claude-sonnet-4-5`).
- Sem mexer nos prompts/system.
- Sem alterar UI das páginas que chamam.

## Validação
- Rodar gerador de VSL e import-creative após o build; conferir logs de servidor (`stack_modern--server-function-logs`) para garantir que não há mais 524 e que o streaming completa.
