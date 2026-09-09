// Fake minimo do Supabase para testar o orquestrador de presenca social.

import type { SupabaseClient } from "@supabase/supabase-js";

type Lead = Record<string, unknown> | null;
type SiteAnalysis = Record<string, unknown> | null;
type SocialRow = Record<string, unknown>;

export function criarFakeDb(seed: { lead?: Lead; siteAnalysis?: SiteAnalysis; socialRows?: SocialRow[] }) {
  const social: SocialRow[] = [...(seed.socialRows ?? [])];
  const lead = seed.lead ?? null;
  const site = seed.siteAnalysis ?? null;

  const fake = {
    social,
    from(tabela: string) {
      if (tabela === "leads") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lead, error: null }) }) }),
        };
      }
      if (tabela === "site_analyses") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: site, error: null }) }) }),
        };
      }
      if (tabela === "social_analyses") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data:
                      social.length > 0
                        ? [...social].sort((a, b) =>
                            String(b.verificado_em).localeCompare(String(a.verificado_em)),
                          )[0]
                        : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          upsert: async (row: SocialRow) => {
            const i = social.findIndex(
              (r) => r.lead_id === row.lead_id && r.plataforma === row.plataforma,
            );
            if (i >= 0) social[i] = { ...social[i], ...row };
            else social.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`fake-db social: tabela nao suportada: ${tabela}`);
    },
  };

  return { db: fake as unknown as SupabaseClient, social };
}
