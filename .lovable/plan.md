
# Plano — "Os Segredos dos Criativos de Alta Conversão"

Landing page de marketing + esqueleto naveg\u00e1vel das 7 \u00e1reas do produto, todas com UI mockada (dados de exemplo, sem backend). Visual fiel \u00e0 imagem de refer\u00eancia: dark navy, gradientes roxo \u2192 azul el\u00e9trico, glassmorphism, cards com brilho sutil.

## Design System (`src/styles.css`)

- Fundo: `oklch(0.12 0.04 270)` (dark navy)
- Prim\u00e1ria: roxo el\u00e9trico `oklch(0.62 0.25 295)`
- Accent: azul neon `oklch(0.7 0.22 260)`
- Foreground claro, muted azulado
- Tokens: `--gradient-primary` (roxo\u2192azul), `--gradient-hero` (radial roxo difuso), `--shadow-glow` (brilho roxo), `--shadow-card` (eleva\u00e7\u00e3o glass)
- Tipografia: display **Space Grotesk** (head) + body **Inter**, carregadas via `<link>` no `__root.tsx`
- Cards: `bg-card/60 backdrop-blur border border-white/5` com hover glow
- Bot\u00e3o "premium": gradiente roxo\u2192azul + shadow-glow

## Estrutura de Rotas (TanStack)

```
src/routes/
  __root.tsx          # head global, fontes, providers
  index.tsx           # Landing p\u00fablica
  app.tsx             # Layout do app (sidebar + outlet)
  app.index.tsx       # \u00c1rea 1 \u2014 Home / Dashboard di\u00e1rio
  app.gerador.tsx     # \u00c1rea 2 \u2014 Gerador de \u00c2ngulos
  app.editor.tsx      # \u00c1rea 3 \u2014 Editor de V\u00eddeo
  app.vsl.tsx         # \u00c1rea 4 \u2014 VSL Curta
  app.escala.tsx      # \u00c1rea 5 \u2014 Fase de Escala
  app.historico.tsx   # \u00c1rea 6 \u2014 Hist\u00f3rico
  app.inteligencia.tsx# \u00c1rea 7 \u2014 Intelig\u00eancia de Nicho
```

Cada rota tem `head()` pr\u00f3prio (title/description/og distintos).

## Landing (`/`)

Se\u00e7\u00f5es, na ordem:
1. **Nav** logo + links (Recursos, Como funciona, Pre\u00e7os) + CTA "Entrar no app"
2. **Hero** \u2014 t\u00edtulo grande "Crie criativos que **escalam no Meta Ads**", subt\u00edtulo sobre metodologia Andromeda 2026, CTA prim\u00e1rio "Come\u00e7ar agora" + secund\u00e1rio "Ver demo", mockup do dashboard com glow roxo atr\u00e1s
3. **Trust strip** \u2014 "Baseado em Andromeda 2026 + Dan Kennedy + Schwartz + Carreiro"
4. **As 7 \u00e1reas** \u2014 bento grid com 7 cards (uma por \u00e1rea do produto), \u00edcone + nome + 1 frase
5. **Como funciona** \u2014 3 passos (Briefing \u2192 \u00c2ngulos \u2192 Editor) com cards conectados
6. **Diferenciais** \u2014 grid: Feed de intelig\u00eancia di\u00e1ria, 5 \u00e2ngulos sempre, Score de qualidade pr\u00e9-export, Safe zones Meta, Fase de escala, VSL curta
7. **Para quem \u00e9** \u2014 chips dos 5 tipos de produto (e-commerce, infoproduto, SaaS, alto ticket, sa\u00fade)
8. **CTA final** \u2014 banner gradiente
9. **Footer**

## Esqueleto do App (`/app/*`)

**Layout (`app.tsx`)**: sidebar colaps\u00e1vel \u00e0 esquerda com as 7 \u00e1reas + header com SidebarTrigger e nome do produto. `<Outlet />` no conte\u00fado.

Cada \u00e1rea \u00e9 uma p\u00e1gina mockada com dados fict\u00edcios mostrando a UI:

- **Home/Dashboard**: feed de intelig\u00eancia (3 cards de tend\u00eancias), card "Sugest\u00e3o do dia" destacado, painel de status (kanban-style com 4 colunas), alertas de satura\u00e7\u00e3o, indicador de volume com barra de progresso
- **Gerador**: form de briefing (URL, tipo de produto, objetivo) + bot\u00e3o "Gerar" \u2192 abaixo mostra diagn\u00f3stico em 4 pontos + 5 cards de \u00e2ngulos (com badge de tipo Carreiro, n\u00edvel Schwartz, hook, estrutura bloco-a-bloco em accordion), bot\u00e3o "Enviar ao editor"
- **Editor**: layout 3 colunas \u2014 esquerda (assets/blocos), centro (preview 9:16 com safe zones marcadas em overlay vermelho), direita (propriedades: voz, m\u00fasica, legendas). Timeline horizontal embaixo. Bot\u00e3o "Exportar" mostra modal com score de qualidade (5 barras)
- **VSL Curta**: timeline expandida de 6 blocos fixos com cores distintas + preview + roteiro
- **Escala**: dois caminhos em tabs (criativo campe\u00e3o do hist\u00f3rico / upload externo), an\u00e1lise do criativo, menu de 7 tipos de varia\u00e7\u00f5es com checkboxes, bot\u00e3o "Gerar lote"
- **Hist\u00f3rico**: tabela/grid de criativos com filtros (produto, \u00e2ngulo, formato, status, per\u00edodo), dropdown de status em cada linha, bot\u00e3o "Escalar" nos performando, bot\u00e3o "Exportar ZIP"
- **Intelig\u00eancia**: cards de benchmarks por nicho (hook rate, hold rate, CPM, CTR), gr\u00e1fico simples (recharts) de tend\u00eancias, padr\u00f5es de \u00e2ngulo por tipo de produto

Todos os controles s\u00e3o visualmente funcionais (estado local) mas n\u00e3o chamam backend.

## T\u00e9cnico

- shadcn/ui: Button, Card, Badge, Tabs, Accordion, Dialog, Dropdown, Input, Select, Slider, Progress, Sidebar, Table
- Imagem: 1 hero mockup gerada via `imagegen` (dashboard fict\u00edcio dark/roxo) + \u00edcones lucide-react para tudo
- Anima\u00e7\u00f5es leves: hover glow nos cards, fade-up no scroll do hero
- Sem dados reais, sem AI, sem persist\u00eancia \u2014 placeholders cr\u00edveis em todas as telas

## Fora deste plano

- Lovable Cloud / banco / auth
- Integra\u00e7\u00e3o real com IA (Lovable AI), Meta Ads, ElevenLabs, Pexels
- Renderiza\u00e7\u00e3o de v\u00eddeo, export MP4, voz sint\u00e9tica
- Score de qualidade real, web search

Esses entram em fases seguintes, quando voc\u00ea habilitar Lovable Cloud e pedir o MVP funcional.
