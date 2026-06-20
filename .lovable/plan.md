## Objetivo

Substituir toda a copy da landing page atual (`src/routes/index.tsx`) pela nova narrativa de vendas fornecida, mantendo o stack visual (cores, fontes, gradientes, `glass`, badges) e gerando novos visuais para ilustrar as seções-chave. Sem mexer no checkout — o preço R$67 fica apenas como texto, com CTA apontando para o fluxo de cadastro/onboarding existente.

## Estrutura final da página (de cima para baixo)

1. **Nav** — manter como está (logo, links, Entrar, Criar conta).
2. **Hero**
   - H1: "Transforme qualquer oferta em criativos que convertem."
   - Sub: "Cole a URL da sua oferta e receba 5 novos ângulos de venda e 5 criativos prontos para anunciar em menos de 5 minutos."
   - CTA primário: "Criar meus primeiros criativos" → `/login?redirect=/app/onboarding`
   - Microcopy: "Sem cartão de crédito"
   - 3 selos de prova: "R$30M investidos em Meta Ads · R$10M gerados recentemente · Milhares de criativos testados"
   - Visual hero novo (substitui `hero-dashboard.jpg`).
3. **Problema** — "O Meta não recompensa quem cria anúncios. Recompensa quem encontra criativos vencedores mais rápido." + lista do processo tradicional + frase final "O problema não é falta de talento. É falta de velocidade."
4. **Apresentando o Andromeda** — "O sistema que transforma ofertas em criativos prontos para escalar." + 3 negações ("Não é apenas...") + lista de 5 pilares (Pesquisa de mercado, Estratégia, Ângulos, Produção, Escala).
5. **Como funciona** — 4 passos numerados (01–04): Cole a URL · Descubra oportunidades · 5 ângulos prontos · Gere seus criativos. Cada um com bullets curtos.
6. **Tudo o que você recebe** — grid de 6 cards: Inteligência de mercado, 5 ângulos, 5 criativos, Editor integrado, Sistema de escala, Histórico completo.
7. **Por que funciona** — bloco editorial destacando "geramos hipóteses de conversão, não conteúdo".
8. **O verdadeiro benefício** — bloco com a frase "Você está comprando velocidade" + comparativos "Enquanto seu concorrente... você...".
9. **Comparação** — 2 colunas: "Processo tradicional (dias)" × "Com Andromeda (menos de 5 minutos)".
10. **Para quem é** — 5 cards: E-commerce, Infoprodutos, SaaS, Serviços, Agências.
11. **O que está incluso (Starter — R$67)** — card com lista de entregas e CTA "Quero começar por R$67" (mesmo destino do CTA principal; nada de checkout novo).
12. **FAQ** — accordion com as 6 perguntas fornecidas.
13. **CTA final** — "Seu próximo criativo vencedor pode estar a menos de 5 minutos de distância." + "Criar meus primeiros criativos" + microcopy "Sem cartão. Sem assinatura. Sem fidelidade."
14. **Footer** — manter.

## Visuais novos (imagegen)

Substituir/adicionar imagens em `src/assets/`:
- `hero-andromeda.jpg` — hero principal: composição abstrata mostrando uma URL "virando" 5 cards de criativo (metáfora de transformação), paleta roxo/violeta do design system, estilo editorial premium.
- `problem-speed.jpg` — ilustração da seção Problema: dois cronômetros/linhas-do-tempo lado a lado, sensação de velocidade.
- `how-it-works.jpg` — visual abstrato da seção "Como funciona" (4 etapas conectadas).

Tom: dark, sofisticado, gradientes roxo→azul já usados no projeto. Sem logos genéricos de IA, sem stock photos.

## Componentes a adicionar

- `Accordion` do shadcn (`@/components/ui/accordion`) para o FAQ — verificar se já existe; se não, adicionar.

## Detalhes técnicos

- Arquivo único: `src/routes/index.tsx`. Reescrever o `Landing` component inteiro.
- Manter os imports/exports do `Route` e `head()` — apenas atualizar `title`/`description` para refletir a nova promessa ("Transforme qualquer oferta em criativos que convertem em menos de 5 minutos.").
- Manter design tokens (`bg-gradient-primary`, `glass`, `shadow-glow`, `text-primary-glow`). Nada de classes de cor hardcoded.
- CTAs: todos os botões "Criar meus primeiros criativos" e "Quero começar por R$67" usam `<Link to="/login" search={{ redirect: "/app/onboarding" }}>`.
- Nav mobile: manter o comportamento existente.
- Sem mudanças em rotas, backend, schema ou secrets.

## Fora de escopo

- Checkout R$67 funcional (apenas texto).
- Mudanças em `/planos`, `/app/*`, ou qualquer página além da landing.
- Mudanças no design system (`src/styles.css`).
