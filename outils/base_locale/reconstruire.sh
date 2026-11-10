#!/usr/bin/env bash
# Reconstruit la base locale JETABLE qui sert à répéter les migrations et à jouer les preuves SQL (tests/sql/*.sql)
# avant toute production. Aucune connexion à la vraie base : tout vient du dépôt (clones de schéma, données fictives,
# migrations). Voir LISEZMOI.md.
#
# Usage : outils/base_locale/reconstruire.sh [--port 55435] [--donnees <dossier>] [--arreter]
#   --port     port d'écoute (défaut 55435)
#   --donnees  dossier du cluster PostgreSQL (défaut <dépôt>/.base-locale, ignoré par git) ; il est SUPPRIMÉ puis refait
#   --arreter  arrête le serveur de ce dossier et sort
# Se connecter ensuite : psql -h 127.0.0.1 -p <port> -U postgres -d postgres
set -u
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=55435
DONNEES="$RACINE/.base-locale"
ARRETER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --donnees) DONNEES="$2"; shift 2 ;;
    --arreter) ARRETER=1; shift ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
CLONES="$RACINE/outils/base_locale/clones"
MIGRATIONS="$RACINE/supabase/migrations"

pg_ctl -D "$DONNEES/pgdata" stop -m fast >/dev/null 2>&1
[ "$ARRETER" = 1 ] && { echo "arrêtée"; exit 0; }

rm -rf "$DONNEES/pgdata"
mkdir -p "$DONNEES"
initdb -D "$DONNEES/pgdata" -U postgres -A trust -E UTF8 --locale=C >/dev/null 2>&1 || { echo "initdb a échoué" >&2; exit 1; }
pg_ctl -D "$DONNEES/pgdata" -o "-p $PORT" -l "$DONNEES/pg.log" -w start >/dev/null 2>&1 || { echo "démarrage impossible (port $PORT pris ?)" >&2; exit 2; }

export PGOPTIONS="-c check_function_bodies=off" PGCLIENTENCODING=UTF8
P="psql -h 127.0.0.1 -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
# 1. Les clones : rôles, auth, stockage, fonctions (1), anonymisation (2), tables (3).
for f in clone_1_fonctions clone_2_anonymisation clone_3_tables; do
  $P -f "$CLONES/$f.sql" || { echo "échec : $f" >&2; exit 3; }
done
# 2. Le lot 4 (rôles et portées) : les clones décrivent la base d'avant lui, sauf les 21 fonctions et les règles de
#    sécurité, que les retours 2 et 3 du lot 4 posent dans leur état d'avant (les migrations 2 et 3 en ont besoin).
#    (La fin du retour 3 retire a_une_affectation, que la migration 3 crée : une doublure la lui fournit.)
$P -1 -f "$MIGRATIONS/20261028_roles_2_fonctions_retour.sql" || { echo "échec : retour 2" >&2; exit 4; }
$P -c "create function public.a_une_affectation(p_email text) returns boolean language sql as 'select false'" || exit 4
$P -1 -f "$MIGRATIONS/20261028_roles_3_regles_retour.sql" || { echo "échec : retour 3" >&2; exit 4; }
# 3. Les données fictives, posées AVANT les migrations du lot 4 : la migration 1 en tire les affectations, comme sur la production.
$P -f "$CLONES/clone_4_donnees.sql" >/dev/null || { echo "échec : clone_4_donnees" >&2; exit 5; }
#    Puis les migrations du lot 4, appliquées dans l'ordre, comme la production les a reçues le 29/10. Les retours ne
#    sont jamais rejoués ensuite.
for f in 20261028_roles_1_fondations 20261028_roles_2_fonctions 20261028_roles_3_regles; do
  $P -1 -f "$MIGRATIONS/$f.sql" || { echo "échec : $f" >&2; exit 4; }
done
echo "OK : base locale prête, port $PORT, dossier $DONNEES"
