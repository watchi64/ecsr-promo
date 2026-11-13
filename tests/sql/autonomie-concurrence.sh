#!/usr/bin/env bash
# Ordre des verrous de l'autonomie entre deux sessions (migration 20261114_autonomie_1_traces), sur la base LOCALE jetable
# seulement (outils/base_locale), jamais sur la production : le script VALIDE des données fictives (puis les retire), ce qu'un
# bloc DO unique ne peut pas montrer (une seule session, une seule transaction : aucune attente possible).
#
# Usage : bash tests/sql/autonomie-concurrence.sh --port 55451
# Prérequis : base reconstruite, suite rejouée, migration appliquée (psql -1 -f supabase/migrations/20261114_autonomie_1_traces.sql).
# Contre-épreuve : appliquer à la place la version d'avant le tour de correction 1 (git show dc8f22ad:...) : ROUGE attendu.
#
# Scénarios (une session tient sa transaction ouverte 4 s, l'autre arrive 1,5 s après) :
#   1. opposition d'abord : le fondateur oppose C1 ; C1 trace pendant ce temps. Attendu : C1 attend, puis n'écrit rien.
#   2. effacement d'abord : le fondateur efface C2 sur demande ; C2 trace pendant ce temps. Attendu : C2 attend, rien n'est écrit.
#   3. écriture d'abord : C3 trace et garde sa transaction ; le fondateur oppose C3. Attendu : l'opposition attend, puis efface
#      la trace validée entre-temps (0 ligne, une opposition).
# Pendant le test, la version exigée des conditions est datée d'hier (la sentinelle refuserait tout) ; elle est remise à la
# fin, ainsi que tout ce que le script a posé.
set -u
PORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
[ -n "$PORT" ] || { echo "usage : $0 --port <port de la base locale>" >&2; exit 2; }
export PGCLIENTENCODING=UTF8
P=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1)

if [ "$("${P[@]}" -c "select to_regclass('public.cours_lectures') is not null")" != "t" ]; then
  echo "migration de l'autonomie absente : l'appliquer d'abord" >&2; exit 2
fi

ancienne_version=$("${P[@]}" -c "select pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)")

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

ok=0; ko=0
juger() { if [ "$2" = "$3" ]; then ok=$((ok + 1)); echo "ok    $1"; else ko=$((ko + 1)); echo "ÉCHEC $1 : obtenu « $2 », attendu « $3 »"; fi; }

# 1. Opposition d'abord.
session conc.fo@example.invalid "public.autonomie_opposer($C1)" 4 >/dev/null &
sleep 1.5
debut=$(date +%s%N)
r=$(session conc.c1@example.invalid "public.autonomie_tracer_cours('$K', 60, false, null)" 0 | grep '^R:' | cut -c3-)
duree=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
juger "1. l'écriture de C1 a attendu l'opposition (plus de 1,5 s : ${duree} ms)" "$([ "$duree" -ge 1500 ] && echo oui || echo non)" "oui"
juger "1. l'écriture de C1 rend faux" "$r" "false"
juger "1. aucune trace de C1 après l'opposition" "$(traces "$C1")" "0"

# 2. Effacement sur demande d'abord.
session conc.fo@example.invalid "public.effacer_sur_demande($C2)" 4 >/dev/null &
sleep 1.5
debut=$(date +%s%N)
r=$(session conc.c2@example.invalid "public.autonomie_tracer_cours('$K', 60, false, null)" 0 | grep '^R:' | cut -c3-)
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

# Ménage : tout ce que le script a posé, et la version exigée d'avant.
"${P[@]}" <<SQL >/dev/null
begin;
delete from cours_lectures where stagiaire_id in ($C1, $C2, $C3);
delete from autonomie_temps where stagiaire_id in ($C1, $C2, $C3);
delete from autonomie_oppositions where stagiaire_id in ($C1, $C2, $C3);
delete from effacements_journal where cible in ('stagiaire $C1', 'stagiaire $C2', 'stagiaire $C3');
delete from conditions_acceptations where email like 'conc.%@example.invalid';
delete from user_profiles where email like 'conc.%@example.invalid';
delete from stagiaires where id in ($C1, $C2, $C3);
delete from settings where promo_id = $PC;
delete from promos where id = $PC;
delete from lieux where nom = 'Concurrence autonomie';
commit;
SQL
"${P[@]}" -c "$ancienne_version" >/dev/null

if [ "$ko" -eq 0 ]; then echo "VERT $ok/0"; exit 0; fi
echo "ROUGE $ok/$ko"; exit 1
