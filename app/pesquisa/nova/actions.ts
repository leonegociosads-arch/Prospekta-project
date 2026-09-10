"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { validarNovaPesquisa } from "@/lib/pesquisa/validacao";
import { estimarConsumo } from "@/lib/pesquisa/estimativa";
import type { EstadoForm } from "./estado";

export async function criarPesquisaAction(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const val = validarNovaPesquisa({
    regiao: formData.get("regiao"),
    nicho: formData.get("nicho"),
    raioKm: formData.get("raio_km"),
    limiteLeads: formData.get("limite_leads"),
  });

  if (!val.ok) {
    return { status: "erro-validacao", erros: val.erros };
  }

  const { regiao, nicho, raioKm, limiteLeads } = val.valores;
  const { orcamentoChamadas } = estimarConsumo(limiteLeads);

  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc("criar_pesquisa", {
      p_regiao: regiao,
      p_nicho: nicho,
      p_raio_km: raioKm,
      p_limite_leads: limiteLeads,
      p_orcamento_chamadas: orcamentoChamadas,
    });

    if (error) {
      console.error("[criarPesquisa] erro do Supabase:", error);
      return {
        status: "erro-supabase",
        mensagem:
          "Nao foi possivel salvar a pesquisa no banco. " +
          "Confira se a migration 0005 foi aplicada e tente de novo.",
      };
    }

    return { status: "ok", searchId: String(data) };
  } catch (e) {
    console.error("[criarPesquisa] excecao:", e);
    return {
      status: "erro-supabase",
      mensagem: "Falha de conexao com o banco. Verifique a internet e tente novamente.",
    };
  }
}
