Plano para corrigir o erro `Anthropic 524`:

1. **Centralizar as chamadas Anthropic**
   - Reutilizar `callAnthropicJson` nas partes que ainda fazem `fetch` direto para Anthropic.
   - Aplicar streaming e retry também em `gerar_angulos` e `pergunta_cirurgica`, que ainda podem estourar 524.

2. **Reduzir risco nas chamadas longas**
   - Diminuir `max_tokens` das chamadas mais pesadas que ainda usam `8192`, especialmente VSL, escala e geração de ângulos.
   - Reduzir `web_search.max_uses` das chamadas mais lentas para evitar timeout.

3. **Melhorar mensagem para o usuário**
   - Atualizar `formatAnthropicError` para tratar `524`, `522`, `502`, `503` e `504` como demora/instabilidade temporária da IA.
   - Evitar mostrar o erro cru `Anthropic 524: error code: 524` no toast.

4. **Manter fallback onde já existe**
   - Preservar o fallback da VSL que já retorna roteiro em modo dev quando a IA falha.
   - Nas outras rotas, manter o comportamento atual, mas com erro amigável e retry antes de falhar.

5. **Validar depois da implementação**
   - Conferir logs de server functions para confirmar que o erro bruto não continua sendo propagado.
   - Verificar as chamadas principais afetadas: geração de ângulos, VSL e escala.