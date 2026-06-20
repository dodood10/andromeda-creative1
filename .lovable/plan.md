## Plano

1. **Parar de depender do `.env` para a service role no frontend/preview**
   - Manter `SUPABASE_SERVICE_ROLE_KEY` como segredo server-side, não como variável `VITE_` nem exposta ao navegador.
   - Ajustar a mensagem de erro para não sugerir reconectar Supabase quando o segredo já existe no ambiente do projeto.

2. **Corrigir imports server-only carregados cedo demais**
   - Remover imports diretos de `@/integrations/supabase/client.server` de arquivos `*.functions.ts` e helpers que entram no grafo do cliente.
   - Carregar `supabaseAdmin` apenas dentro de handlers/funções server-side usando `await import(...)`, especialmente em:
     - `src/lib/criativos.functions.ts`
     - `src/lib/admin.functions.ts`
     - `src/lib/stock-media.functions.ts`
     - helpers de rastreio como `api-usage` e `funnel-events`

3. **Preservar segurança**
   - Não mover `SUPABASE_SERVICE_ROLE_KEY` para `VITE_`.
   - Não expor a chave no bundle do browser.
   - Manter operações admin apenas no servidor.

4. **Validar o ponto do erro**
   - Conferir logs do dev server depois da alteração.
   - Verificar que a página inicial/fluxo não dispara mais `Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY` por import prematuro.

## Observação

Mesmo que o `.env` tenha credenciais públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), a `SUPABASE_SERVICE_ROLE_KEY` precisa existir como segredo server-side e só pode ser lida em código executado no servidor. O erro atual indica principalmente que algum módulo admin está sendo importado antes/fora do contexto correto.