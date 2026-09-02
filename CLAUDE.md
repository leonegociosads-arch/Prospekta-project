@AGENTS.md

# Prospekta

Ferramenta pessoal de prospecção de leads. Uso próprio, custo mínimo.

- **Plano completo:** `docs/prospekta-plano.html` (arquitetura, banco, ordem de desenvolvimento, controle de custo da Google Places API). Ler antes de decisões estruturais.
- **Stack:** Next.js 16 + TypeScript + Tailwind 4 · Supabase (Postgres) Free · worker Node local. Sem n8n no MVP.
- **Fonte de descoberta:** Google Places API (New) — Text Search. Camada de cache + orçamento obrigatória antes de qualquer chamada.
- **Estado atual:** esqueleto recém-criado. Sem banco, sem worker, sem módulos ainda.
- **Chaves:** `.env.local` (nunca commitado). Modelo em `.env.example`.
