#!/usr/bin/env bash
# D4 de l'étape 3 des titres (migration 20261115_titres_7_correctifs, partie B) : deux sessions qui ajustent ou donnent en même temps
# un titre du réseau depuis le même centre ne laissent jamais deux versions de ce titre dans ce centre, ni un porteur sur le titre du
# réseau quand la version existe. Sur la base LOCALE jetable seulement (outils/base_locale), jamais sur la production : le script
# VALIDE des données fictives (puis les retire), ce qu'un bloc DO unique ne peut pas montrer (une seule session : aucune attente).
#
# Usage : bash tests/sql/titres-concurrence.sh --port 55450 [--cas 1,2,3,4]
# Prérequis : base reconstruite, rejouer_suite.sh --production (migration 6 des titres en place), avec ou sans la migration 7
# (psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_7_correctifs.sql).
# Contre-épreuve : sans la migration 7, ROUGE attendu (cas 3 : deux versions ; cas 2 et 4 : le porteur reste sur le titre du réseau ;
# cas 1 : la seconde session échoue sur l'affectation du porteur).
#
# Garde de la base locale, AVANT toute écriture (refus, code 3, sinon) : connexion par 127.0.0.1 sur le port donné (inet_server_addr,
# inet_server_port) ; auth.users non vide et tous ses comptes en @local.test (comptes fictifs de clone_4_donnees.sql) ; migration 6
# des titres en place (donner_titre) ; aucun reste d'un passage précédent (titre « Preuve9 conc ... »).
#
# Personnages (posés et validés par le script, retirés à la sortie) : « chef », titre de centre non fixe « Preuve9 conc chef » au centre
# de la promo 1 (Promos et Stagiaires en Voir, Équipe en Modifier) ; quatre titres du réseau de niveau centre, R1 à R4 (Promos et
# Équipe en Voir) ; u porte R1 au centre 1 ; w et w2 reçoivent R2 et R4 pendant les cas 2 et 4.
# Cas (la première session garde sa transaction ouverte 3 s après son geste, la seconde arrive 1 s après) :
#   1. chef ajuste R1 depuis le centre 1 (nom « Preuve A ») ; chef ajuste R1 (nom « Preuve B »). Attendu : une version, créée par la
#      première, modifiée par la seconde (version_creee faux), nommée « Preuve B », u porte la version.
#   2. chef ajuste R2 depuis le centre 1 ; chef donne R2 à w au centre 1. Attendu : une version, w la porte.
#   3. chef ajuste R3 (non porté, « Preuve C ») ; chef ajuste R3 (« Preuve D »). Attendu : une version, « Preuve D », version_creee
#      faux pour la seconde (sans la migration 7 : deux versions).
#   4. chef donne R4 à w2 au centre 1 ; chef ajuste R4 depuis le centre 1. Attendu : une version, w2 la porte (l'ajustement attend le
#      don et fait basculer w2).
# Le verrou titres_ouverts est ouvert le temps du script (le don le demande), puis remis dans son état de départ. À la sortie, quelle
# qu'elle soit, un piège retire tout ce que le script a posé ; si ce ménage échoue, le verdict est ROUGE.
set -euo pipefail
PORT=""
CAS="1,2,3,4"
while [ $# -gt 0 ]; do
  case "$1" in
    --port) [ $# -ge 2 ] || { echo "--port demande un numéro" >&2; exit 2; }; PORT="$2"; shift 2 ;;
    --cas) [ $# -ge 2 ] || { echo "--cas demande une liste (1,2,3,4)" >&2; exit 2; }; CAS="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
[ -n "$PORT" ] || { echo "usage : $0 --port <port de la base locale> [--cas 1,2,3,4]" >&2; exit 2; }
case "$PORT" in *[!0-9]*) echo "port invalide : $PORT" >&2; exit 2 ;; esac
case ",$CAS," in *[!0-9,]*) echo "liste de cas invalide : $CAS" >&2; exit 2 ;; esac
export PGCLIENTENCODING=UTF8
P=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1)
joue() { case ",$CAS," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }

# --- Garde : base locale jetable, rien d'écrit avant ---------------------------------------------------------------
# (Requête en ASCII seul : un argument -c accentué n'arrive pas en UTF-8 sous Windows ; les phrases sont écrites ici.)
garde=$("${P[@]}" -c "select case
    when coalesce(host(inet_server_addr()), '') <> '127.0.0.1' then 'adresse ' || coalesce(host(inet_server_addr()), 'socket')
    when inet_server_port() <> $PORT then 'port ' || inet_server_port()
    when to_regclass('auth.users') is null then 'auth_absente'
    when not exists (select 1 from auth.users) then 'auth_vide'
    when exists (select 1 from auth.users where email is null or email not like '%@local.test') then
      'hors_local ' || (select count(*) from auth.users where email is null or email not like '%@local.test')
    when to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is null then 'migration_absente'
    when exists (select 1 from public.titres where nom like 'Preuve9 conc%') then 'restes'
    else 'ok' end") || { echo "REFUS : base injoignable sur 127.0.0.1:$PORT. Rien n'a été écrit." >&2; exit 3; }
if [ "$garde" != "ok" ]; then
  case "$garde" in
    adresse*) motif="le serveur ne répond pas sur 127.0.0.1 (${garde#adresse })" ;;
    port*) motif="le serveur écoute sur le port ${garde#port }, pas sur $PORT" ;;
    auth_absente) motif="table auth.users absente" ;;
    auth_vide) motif="auth.users est vide, la base locale y a ses comptes fictifs" ;;
    hors_local*) motif="${garde#hors_local } compte(s) de auth.users hors @local.test" ;;
    migration_absente) motif="migration 6 des titres absente : rejouer_suite.sh --production d'abord" ;;
    restes) motif="restes d'un passage précédent (titre Preuve9 conc) : reconstruire la base" ;;
    *) motif="$garde" ;;
  esac
  echo "REFUS : ce n'est pas la base locale jetable attendue, ou elle n'est pas prête ($motif). Rien n'a été écrit." >&2
  exit 3
fi

verrou_avant=$("${P[@]}" -c "select coalesce((select value from public.settings where promo_id is null and key = 'titres_ouverts'), '<absent>')")

ok=0; ko=0; fini=0
juger() { if [ "$2" = "$3" ]; then ok=$((ok + 1)); echo "ok    $1"; else ko=$((ko + 1)); echo "ÉCHEC $1 : obtenu « $2 », attendu « $3 »"; fi; }
informer() { echo "info  $1"; }

# --- Ménage, toujours joué à la sortie ------------------------------------------------------------------------------
menage() {
  local code=$? propre=1
  trap - EXIT INT TERM
  set +e
  local enfants
  enfants=$(jobs -p)
  [ -n "$enfants" ] && kill $enfants 2>/dev/null
  wait 2>/dev/null
  "${P[@]}" -v verrou="$verrou_avant" <<'SQL' || propre=0
begin;
create temp table conc_titres on commit drop as
  select id from public.titres where nom like 'Preuve9 conc%'
  union select v.id from public.titres v join public.titres r on r.id = v.origine_id where r.nom like 'Preuve9 conc%';
delete from public.affectations where titre_id in (select id from conc_titres) or email like 'preuve9.conc.%@exemple.invalid';
do $j$
begin
  if to_regclass('public.journal_droits') is not null then
    execute 'delete from public.journal_droits where lower(par) like ''preuve9.conc.%@exemple.invalid'' or lower(pour) like ''preuve9.conc.%@exemple.invalid''';
  end if;
end $j$;
delete from public.titres where origine_id in (select id from conc_titres);
delete from public.titres where id in (select id from conc_titres);
delete from public.user_profiles where email like 'preuve9.conc.%@exemple.invalid';
delete from public.settings where promo_id is null and key = 'titres_ouverts';
insert into public.settings (key, value, promo_id) select 'titres_ouverts', :'verrou', null where :'verrou' <> '<absent>';
commit;
SQL
  local reste
  reste=$("${P[@]}" -c "select (select count(*) from public.titres where nom like 'Preuve9 conc%' or nom in ('Preuve A', 'Preuve B', 'Preuve C', 'Preuve D'))
      + (select count(*) from public.affectations where email like 'preuve9.conc.%@exemple.invalid')
      + (select count(*) from public.user_profiles where email like 'preuve9.conc.%@exemple.invalid')
      + (case when coalesce((select value from public.settings where promo_id is null and key = 'titres_ouverts'), '<absent>') = '$verrou_avant' then 0 else 1 end)") || reste="illisible"
  if [ "$reste" != "0" ]; then
    propre=0
    echo "ÉCHEC ménage : il reste des données du script ou le verrou n'est pas remis ($reste)" >&2
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

# --- Données fictives, validées --------------------------------------------------------------------------------------
"${P[@]}" <<'SQL'
begin;
do $f$
declare l1 integer := (select lieu_id from public.promos where id = 1); v_chef bigint; v_r1 bigint; k integer;
begin
  insert into public.user_profiles (email, role, is_admin) values
    ('preuve9.conc.chef@exemple.invalid', 'prof', false), ('preuve9.conc.u@exemple.invalid', 'prof', false);
  insert into public.titres (nom, niveau, lieu_id, cases, cree_par)
    values ('Preuve9 conc chef', 'centre', l1, '{"promos":"voir","stagiaires":"voir","equipe":"modifier"}', 'preuve') returning id into v_chef;
  insert into public.affectations (email, role, lieu_id, titre_id) values ('preuve9.conc.chef@exemple.invalid', 'direction', l1, v_chef);
  for k in 1 .. 4 loop
    insert into public.titres (nom, niveau, lieu_id, cases, cree_par)
      values ('Preuve9 conc R' || k, 'centre', null, '{"promos":"voir","equipe":"voir"}', 'preuve');
  end loop;
  select id into v_r1 from public.titres where nom = 'Preuve9 conc R1';
  insert into public.affectations (email, role, lieu_id, titre_id) values ('preuve9.conc.u@exemple.invalid', 'direction', l1, v_r1);
  delete from public.settings where promo_id is null and key = 'titres_ouverts';
  insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null);
end $f$;
commit;
SQL

L1=$("${P[@]}" -c "select lieu_id from public.promos where id = 1")
tid() { "${P[@]}" -c "select id from public.titres where nom = 'Preuve9 conc $1'"; }
R1=$(tid R1); R2=$(tid R2); R3=$(tid R3); R4=$(tid R4)
[ -n "$L1" ] && [ -n "$R1" ] && [ -n "$R2" ] && [ -n "$R3" ] && [ -n "$R4" ] || { echo "données fictives introuvables" >&2; exit 1; }

# Une session de chef : joue une instruction, garde la transaction ouverte $2 s, valide. Sortie : la ligne « R:<valeur> », ou la
# phrase de l'erreur (sans le préfixe ERROR/ERREUR de psql) si l'instruction est refusée (la transaction est alors annulée).
session() {
  "${P[@]}" 2>&1 <<SQL || true
begin;
select set_config('request.jwt.claims', '{"email": "preuve9.conc.chef@exemple.invalid", "role": "authenticated"}', true);
set local role authenticated;
select 'R:' || coalesce(($1)::text, 'nul');
select pg_sleep($2);
commit;
SQL
}
resultat() { sed -n -e 's/^R://p' -e 's/^.*\(ERROR\|ERREUR\): *//p' | head -n 1; }
ajuster() { echo "(select public.ajuster_titre($1, $L1, '$2', '{\"promos\":\"voir\",\"equipe\":\"voir\"}'::jsonb) ->> 'version_creee')"; }
donner() { echo "(select 'donne' from (select public.donner_titre('$1', $2, $L1, null, null)) q)"; }
versions() { "${P[@]}" -c "select count(*) from public.titres where origine_id = $1 and lieu_id = $L1"; }
version() { "${P[@]}" -c "select coalesce((select id::text from public.titres where origine_id = $1 and lieu_id = $L1 order by id limit 1), 'aucune')"; }
nom_version() { "${P[@]}" -c "select coalesce((select nom from public.titres where origine_id = $1 and lieu_id = $L1 order by id limit 1), 'aucune')"; }
porte() { "${P[@]}" -c "select coalesce((select string_agg(titre_id::text, ',' order by titre_id) from public.affectations where email = '$1'), 'rien')"; }

# Deux sessions : la première joue $1 et attend 3 s ; la seconde joue $2, 1 s après. Résultats dans r1 et r2.
deux_sessions() {
  local f1
  f1=$(mktemp)
  session "$1" 3 > "$f1" &
  sleep 1
  r2=$(session "$2" 0 | resultat)
  wait
  r1=$(resultat < "$f1")
  rm -f "$f1"
}

if joue 1; then
  deux_sessions "$(ajuster "$R1" 'Preuve A')" "$(ajuster "$R1" 'Preuve B')"
  juger "1. deux ajustements de R1 (porté par u au centre 1) : une seule version au centre 1" "$(versions "$R1")" "1"
  juger "1. la première session crée la version (version_creee vrai)" "$r1" "true"
  juger "1. la seconde session modifie la version au lieu d'en créer une (version_creee faux)" "$r2" "false"
  juger "1. la version porte le nom de la seconde session" "$(nom_version "$R1")" "Preuve B"
  juger "1. u porte la version du centre" "$(porte preuve9.conc.u@exemple.invalid)" "$(version "$R1")"
fi

if joue 2; then
  deux_sessions "$(ajuster "$R2" 'Preuve9 conc version 2')" "$(donner preuve9.conc.w@exemple.invalid "$R2")"
  juger "2. l'ajustement de R2 crée la version" "$r1" "true"
  juger "2. le don de R2 à w, pendant l'ajustement, aboutit" "$r2" "donne"
  juger "2. une seule version de R2 au centre 1" "$(versions "$R2")" "1"
  juger "2. w porte la version du centre, pas le titre du réseau" "$(porte preuve9.conc.w@exemple.invalid)" "$(version "$R2")"
fi

if joue 3; then
  deux_sessions "$(ajuster "$R3" 'Preuve C')" "$(ajuster "$R3" 'Preuve D')"
  juger "3. deux ajustements de R3 (non porté) : une seule version au centre 1" "$(versions "$R3")" "1"
  juger "3. la première session crée la version" "$r1" "true"
  juger "3. la seconde session modifie la version (version_creee faux)" "$r2" "false"
  juger "3. la version porte le nom de la seconde session" "$(nom_version "$R3")" "Preuve D"
fi

if joue 4; then
  deux_sessions "$(donner preuve9.conc.w2@exemple.invalid "$R4")" "$(ajuster "$R4" 'Preuve9 conc version 4')"
  juger "4. le don de R4 à w2 aboutit" "$r1" "donne"
  juger "4. l'ajustement de R4, pendant le don, crée la version" "$r2" "true"
  juger "4. une seule version de R4 au centre 1" "$(versions "$R4")" "1"
  juger "4. w2 porte la version du centre (l'ajustement l'a fait basculer)" "$(porte preuve9.conc.w2@exemple.invalid)" "$(version "$R4")"
fi

fini=1
# Le verdict (VERT ou ROUGE) est écrit par le ménage, à la sortie.
