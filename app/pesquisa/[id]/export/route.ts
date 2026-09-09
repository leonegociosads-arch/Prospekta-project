import { supabaseServer } from "@/lib/supabase/server";
import { carregarLeadsDaPesquisa } from "@/lib/leads/consulta";
import { leadsParaCsv, nomeArquivoCsv } from "@/lib/leads/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: pesquisa, error } = await db
    .from("searches")
    .select("nicho, regiao_texto")
    .eq("id", id)
    .maybeSingle();
  if (error) return new Response(`Erro: ${error.message}`, { status: 500 });
  if (!pesquisa) return new Response("Pesquisa não encontrada", { status: 404 });

  const leads = await carregarLeadsDaPesquisa(db, id);
  const csv = leadsParaCsv(leads);
  const nome = nomeArquivoCsv(pesquisa.nicho as string, pesquisa.regiao_texto as string);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
