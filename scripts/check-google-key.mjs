// Verifica se a GOOGLE_MAPS_API_KEY do .env.local funciona.
// Uso:  npm run check:google
// Faz 1 chamada Text Search (faixa barata) e mostra os resultados.
// A chave nunca e impressa inteira.

const key = process.env.GOOGLE_MAPS_API_KEY;

if (!key) {
  console.error("\n[x] GOOGLE_MAPS_API_KEY nao encontrada no .env.local");
  console.error("    Abra o arquivo .env.local e cole a chave depois de 'GOOGLE_MAPS_API_KEY='\n");
  process.exit(1);
}

console.log("\nChave carregada:", key.slice(0, 6) + "..." + key.slice(-4));
console.log("Testando: Text Search -> \"advocacia em Iguape, SP\" (pageSize 3)\n");

const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
    // Faixa minima: id + nome + endereco. Nada de rating/site/telefone aqui.
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
  },
  body: JSON.stringify({
    textQuery: "advocacia em Iguape, SP",
    languageCode: "pt-BR",
    pageSize: 3,
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error("[x] A API respondeu com erro", res.status);
  console.error(JSON.stringify(data, null, 2));
  console.error("\nCausas comuns:");
  console.error(" - Places API (New) nao ativada no projeto");
  console.error(" - Faturamento nao ativado");
  console.error(" - Chave restrita a outras APIs / outro IP");
  console.error(" - Cota diaria ja atingida (RESOURCE_EXHAUSTED)\n");
  process.exit(1);
}

const places = data.places ?? [];
console.log(`[ok] Funcionou -- ${places.length} resultado(s):\n`);
for (const p of places) {
  console.log("  -", p.displayName?.text ?? "(sem nome)", "|", p.formattedAddress ?? "");
}
console.log("\nAmanha, confira em Faturamento > Relatorios que ficou em US$ 0.\n");
