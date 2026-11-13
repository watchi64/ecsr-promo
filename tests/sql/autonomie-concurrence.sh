#!/usr/bin/env bash
# Ordre des verrous de l'autonomie entre deux sessions (migration 20261114_autonomie_1_traces), sur la base LOCALE jetable
# seulement (outils/base_locale), jamais sur la production : le script VALIDE des données fictives (puis les retire), ce qu'un
# bloc DO unique ne peut pas montrer (une seule session, une seule transaction : aucune attente possible).
#
# Usage : bash tests/sql/autonomie-concurrence.sh --port 55451
# Prérequis : base reconstruite, suite rejouée, migration appliquée (psql -1 -f supabase/migrations/20261114_autonomie_1_traces.sql),
# avec ou sans la migration 2 (version datée).
# Contre-épreuve : appliquer à la place la version d'avant le tour de correction 1 (git show dc8f22ad:...) : ROUGE attendu.
#
# Garde de la base locale, AVANT toute écriture (refus, code 3, sinon) :
#   - la connexion passe par 127.0.0.1 sur le port donné, et le serveur dit écouter là (inet_server_addr, inet_server_port) :
#     un tunnel ou un relais vers une autre machine montre une autre adresse ;
#   - auth.users a au moins un compte et TOUS ses comptes finissent par @local.test : ce sont les comptes fictifs de
#     outils/base_locale/clones/clone_4_donnees.sql ; une base réelle a des adresses réelles, une seule suffit à refuser ;
#   - aucun reste d'un passage précédent (promo « Concurrence »).
#
# Scénarios (une session tient sa transaction ouverte 4 s, l'autre arrive 1,5 s après) :
#   1. opposition d'abord : le fondateur oppose C1 ; C1 trace pendant ce temps. Attendu : C1 attend, puis n'écrit rien.
#   2. effacement d'abord : le fondateur efface C2 sur demande ; C2 trace pendant ce temps. Attendu : C2 attend, rien n'est écrit.
#   3. écriture d'abord : C3 trace et garde sa transaction ; le fondateur oppose C3. Attendu : l'opposition attend, puis efface
#      la trace validée entre-temps (0 ligne, une opposition).
# Pendant le test, la version exigée des conditions est datée d'hier (la sentinelle refuserait tout). À la sortie, quelle qu'elle
# soit (réussite, échec, interruption), un piège remet la version d'avant et retire tout ce que le script a posé ; si ce
# ménage échoue, le verdict est ROUGE.
set -euo pipefail
PORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) [ $# -ge 2 ] || { echo "--port demande un numéro" >&2; exit 2; }; PORT="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
[ -n "$PORT" ] || { echo "usage : $0 --port <port de la base locale>" >&2; exit 2; }
case "$PORT" in *[!0-9]*) echo "port invalide : $PORT" >&2; exit 2 ;; esac
export PGCLIENTENCODING=UTF8
P=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1)

# --- Garde : base locale jetable, rien d'écrit avant ---------------------------------------------------------------
# (Requête en ASCII seul : un argument -c accentué n'arrive pas en UTF-8 sous Windows ; les phrases sont écrites ici.)
garde=$("${P[@]}" -c "select case
    when coalesce(host(inet_server_addr()), '') <> '127.0.0.1' then 'adresse ' || coalesce(host(inet_server_addr()), 'socket')
    when inet_server_port() <> $PORT then 'port ' || inet_server_port()
    when to_regclass('auth.users') is null then 'auth_absente'
    when not exists (select 1 from auth.users) then 'auth_vide'
    when exists (select 1 from auth.users where email is null or email not like '%@local.test') then
      'hors_local ' || (select count(*) from auth.users where email is null or email not like '%@local.test')
    when to_regclass('public.cours_lectures') is null then 'migration_absente'
    when exists (select 1 from public.promos where nom = 'Concurrence') then 'restes'
    else 'ok' end") || { echo "REFUS : base injoignable sur 127.0.0.1:$PORT. Rien n'a été écrit." >&2; exit 3; }
if [ "$garde" != "ok" ]; then
  case "$garde" in
    adresse*) motif="le serveur ne répond pas sur 127.0.0.1 (${garde#adresse })" ;;
    port*) motif="le serveur écoute sur le port ${garde#port }, pas sur $PORT" ;;
    auth_absente) motif="table auth.users absente" ;;
    auth_vide) motif="auth.users est vide, la base locale y a ses comptes fictifs" ;;
    hors_local*) motif="${garde#hors_local } compte(s) de auth.users hors @local.test" ;;
    migration_absente) motif="migration de l'autonomie absente : l'appliquer d'abord" ;;
    restes) motif="restes d'un passage précédent (promo Concurrence) : reconstruire la base" ;;
    *) motif="$garde" ;;
  esac
  echo "REFUS : ce n'est pas la base locale jetable attendue, ou elle n'est pas prête ($motif). Rien n'a été écrit." >&2
  exit 3
fi

# psql sous Windows écrit les sauts de ligne d'une valeur en CRLF : retirés, sinon la fonction remise porterait des \r.
ancienne_version=$("${P[@]}" -c "select pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)" | tr -d '\r')
ancienne_empreinte=$("${P[@]}" -c "select md5(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)) || coalesce((select proacl::text from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure), '')")
[ -n "$ancienne_version" ] && [ -n "$ancienne_empreinte" ] || { echo "REFUS : version des conditions illisible. Rien n'a été écrit." >&2; exit 3; }

ok=0; ko=0; fini=0
juger() { if [ "$2" = "$3" ]; then ok=$((ok + 1)); echo "ok    $1"; else ko=$((ko + 1)); echo "ÉCHEC $1 : obtenu « $2 », attendu « $3 »"; fi; }

# --- Ménage, toujours joué à la sortie ------------------------------------------------------------------------------
# Retire tout ce qui porte les marques du script (promo et lieu « Concurrence », adresses conc.*@example.invalid), remet la
# version d'avant, puis vérifie que rien ne reste. Code de sortie : 0 si tout est propre et les huit contrôles sont verts.
menage() {
  local code=$? propre=1
  trap - EXIT INT TERM
  set +e
  local enfants
  enfants=$(jobs -p)
  [ -n "$enfants" ] && kill $enfants 2>/dev/null
  wait 2>/dev/null
  "${P[@]}" <<'SQL' || propre=0
begin;
create temp table conc_fiches on commit drop as
  select s.id from public.stagiaires s join public.promos p on p.id = s.promo_id where p.nom = 'Concurrence'
  union select stagiaire_id from public.user_profiles where email like 'conc.%@example.invalid' and stagiaire_id is not null;
delete from public.cours_lectures where stagiaire_id in (select id from conc_fiches);
delete from public.autonomie_temps where stagiaire_id in (select id from conc_fiches);
delete from public.autonomie_oppositions where stagiaire_id in (select id from conc_fiches);
do $j$
begin
  if to_regclass('public.effacements_journal') is not null then
    execute 'delete from public.effacements_journal where cible in (select ''stagiaire '' || id from conc_fiches)';
  end if;
end $j$;
delete from public.conditions_acceptations where email like 'conc.%@example.invalid';
delete from public.user_profiles where email like 'conc.%@example.invalid';
delete from public.stagiaires where id in (select id from conc_fiches);
delete from public.settings where promo_id in (select id from public.promos where nom = 'Concurrence');
delete from public.promos where nom = 'Concurrence';
delete from public.lieux where nom = 'Concurrence autonomie';
commit;
SQL
  "${P[@]}" -c "$ancienne_version" >/dev/null || propre=0
  local reste
  reste=$("${P[@]}" -c "select (select count(*) from public.promos where nom = 'Concurrence')
      + (select count(*) from public.lieux where nom = 'Concurrence autonomie')
      + (select count(*) from public.user_profiles where email like 'conc.%@example.invalid')
      + (select count(*) from public.conditions_acceptations where email like 'conc.%@example.invalid')
      + (select count(*) from public.stagiaires where prenom like 'Concurrence C%')
      + (case when md5(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure))
                   || coalesce((select proacl::text from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure), '')
                   = '$ancienne_empreinte' then 0 else 1 end)") || reste="illisible"
  if [ "$reste" != "0" ]; then
    propre=0
    echo "ÉCHEC ménage : il reste des données du script ou la version n'est pas remise ($reste)" >&2
  fi
  if [ "$fini" = 1 ] && [ "$ko" -eq 0 ] && [ "$propre" = 1 ] && [ "$code" -eq 0 ]; then
    echo "VERT $ok/0"
    exit 0
  fi
  [ "$fini" = 1 ] || echo "interrompu avant la fin (code $code)" >&2
  [ "$propre" = 1 ] || ko=$((ko + 1))
  [ "$fini" = 1 ] || ko=$((ko + 1))
  echo "ROUGE $ok/$ko"
  exit 1
}
trap menage EXIT
trap 'exit 130' INT TERM

# --- Données fictives et version datée d'hier ------------------------------------------------------------------------
"${P[@]}" <<'SQL'
begin;
do $f$
declare l integer; pc integer; s integer; v_k text;
begin
  insert into lieux (nom) values ('Concurrence autonomie') returning id into l;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (l, 'Concurrence', current_date - 30, current_date + 200) returning id into pc;
  foreach v_k in array array['C1', 'C2', 'C3'] loop
    insert into stagiaires (prenom, nom, promo_id) values ('Concurrence ' || v_k, 'PREUVE', pc) returning id into s;
    insert into user_profiles (email, role, stagiaire_id) values ('conc.' || lower(v_k) || '@example.invalid', 'stagiaire', s);
  end loop;
  insert into user_profiles (email, role, is_admin, is_founder) values ('conc.fo@example.invalid', 'prof', true, true);
  insert into settings (key, value, promo_id) values ('autonomie_active', 'true', pc);
  insert into conditions_acceptations (email, version)
    select 'conc.' || x.c || '@example.invalid', to_char(current_date - 1, 'YYYY-MM-DD') from unnest(array['c1', 'c2', 'c3']) x(c);
  execute format('create or replace function public._autonomie_version_conditions() returns text language sql immutable '
                 'set search_path to ''public'', ''pg_temp'' as $v$ select %L::text $v$', to_char(current_date - 1, 'YYYY-MM-DD'));
end $f$;
commit;
SQL

PC=$("${P[@]}" -c "select id from promos where nom = 'Concurrence'")
K=$("${P[@]}" -c "select id from cours where published order by numero nulls last, id limit 1")
sid() { "${P[@]}" -c "select id from stagiaires where prenom = 'Concurrence $1'"; }
C1=$(sid C1); C2=$(sid C2); C3=$(sid C3)
[ -n "$PC" ] && [ -n "$K" ] && [ -n "$C1" ] && [ -n "$C2" ] && [ -n "$C3" ] || { echo "données fictives introuvables" >&2; exit 1; }

# Une session qui se connecte sous une adresse, joue une instruction, garde la transaction ouverte $3 s, valide.
session() {
  "${P[@]}" <<SQL
begin;
select set_config('request.jwt.claims', '{"email": "$1", "role": "authenticated"}', true),
       set_config('request.headers', '{"x-promo-id": "$PC"}', true);
set local role authenticated;
select 'R:' || coalesce(($2)::text, '') as resultat;
select pg_sleep($3);
commit;
SQL
}
traces() { "${P[@]}" -c "select (select count(*) from cours_lectures where stagiaire_id = $1) + (select count(*) from autonomie_temps where stagiaire_id = $1)"; }
# Le résultat d'une session (la ligne « R:... »), vide si elle n'en a pas rendu (le contrôle qui suit échoue alors).
resultat() { grep '^R:' | cut -c3- || true; }

# 1. Opposition d'abord.
session conc.fo@example.invalid "public.autonomie_opposer($C1)" 4 >/dev/null &
sleep 1.5
debut=$(date +%s%N)
r=$(session conc.c1@example.invalid "public.autonomie_tracer_cours('$K', 60, false, null)" 0 | resultat)
duree=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
juger "1. l'écriture de C1 a attendu l'opposition (plus de 1,5 s : ${duree} ms)" "$([ "$duree" -ge 1500 ] && echo oui || echo non)" "oui"
juger "1. l'écriture de C1 rend faux" "$r" "false"
juger "1. aucune trace de C1 après l'opposition" "$(traces "$C1")" "0"

# 2. Effacement sur demande d'abord.
session conc.fo@example.invalid "public.effacer_sur_demande($C2)" 4 >/dev/null &
sleep 1.5
debut=$(date +%s%N)
r=$(session conc.c2@example.invalid "public.autonomie_tracer_cours('$K', 60, false, null)" 0 | resultat)
duree=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
juger "2. l'écriture de C2 a attendu l'effacement (plus de 1,5 s : ${duree} ms)" "$([ "$duree" -ge 1500 ] && echo oui || echo non)" "oui"
juger "2. l'écriture de C2 rend faux" "$r" "false"
juger "2. aucune trace de C2 après l'effacement" "$(traces "$C2")" "0"

# 3. Écriture d'abord, opposition pendant la transaction.
session conc.c3@example.invalid "public.autonomie_tracer_cours('$K', 60, false, null)" 4 >/dev/null &
sleep 1.5
debut=$(date +%s%N)
session conc.fo@example.invalid "public.autonomie_opposer($C3)" 0 >/dev/null
duree=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
juger "3. l'opposition de C3 a attendu l'écriture en cours (plus de 1,5 s : ${duree} ms)" "$([ "$duree" -ge 1500 ] && echo oui || echo non)" "oui"
juger "3. la trace validée entre-temps est effacée, l'opposition posée" "$(traces "$C3")/$("${P[@]}" -c "select count(*) from autonomie_oppositions where stagiaire_id = $C3")" "0/1"

fini=1
# Le verdict (VERT ou ROUGE) est écrit par le ménage, à la sortie.
