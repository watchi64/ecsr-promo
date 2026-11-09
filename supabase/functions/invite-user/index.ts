// Edge Function invite-user : RETIRÉE au lot 4 (rôles et portées en base, 08/11/2026).
// L'ancienne version ajoutait un compte avec la clé de service, sur le seul drapeau is_admin, sans tenir compte des
// promos ni des lieux : elle contournait les nouvelles portées. L'app invite désormais par la fonction de la base
// inviter_compte (portées vérifiées par la base). Cette version ne fait plus rien : elle répond à une copie ancienne de
// l'app, encore ouverte, qu'il faut la recharger. Aucune clé de service, aucune écriture.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(
    JSON.stringify({ error: "L'invitation a changé : recharge l'app (ou mets-la à jour), puis réessaie." }),
    { status: 410, headers: { "Content-Type": "application/json", ...cors } },
  );
});
