import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase para uso NO SERVIDOR:
 * Server Components, Server Actions e o worker.
 *
 * Usa a service role key (sb_secret_...), que ignora o RLS.
 * O `import "server-only"` acima faz o build QUEBRAR se este arquivo
 * for importado, mesmo que sem querer, num componente de cliente.
 */
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase nao configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
