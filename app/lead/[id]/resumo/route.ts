// GET /lead/[id]/resumo -> JSON com o andamento do lead.
// O card da tabela consulta isto a cada poucos segundos enquanto processa.

import { supabaseServer } from "@/lib/supabase/server";
import { carregarResumoLead } from "@/lib/lead/resumo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const resumo = await carregarResumoLead(supabaseServer(), id);
    if (!resumo) {
      return Response.json({ erro: "lead nao encontrado" }, { status: 404 });
    }
    return Response.json(resumo, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[GET /lead/:id/resumo] excecao:", e);
    return Response.json({ erro: "falha ao carregar o resumo" }, { status: 500 });
  }
}
