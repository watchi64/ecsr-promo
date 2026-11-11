#!/usr/bin/env bash
# Rejoue, sur la base locale reconstruite (reconstruire.sh), les migrations du dépôt postérieures au lot 4, dans l'ordre
# où la production les a reçues, pour que les preuves SQL se jouent sur un état identique à la production.
#
# Usage : outils/base_locale/rejouer_suite.sh [--port 55435] [--avec-titres] [--titres 1,2,3[,4][,5][,6]]
#   --port         port de la base locale (défaut 55435)
#   --avec-titres  ajoute ensuite les migrations 20261112_titres_1 à _4 (chantier titres et droits à la carte) ; vaut --titres 1,2,3,4
#   --titres       ajoute ensuite les migrations 20261112_titres_<n>_* dans l'ordre de la liste (la production a reçu 1, 2, 3) ;
#                  un fichier manquant arrête le script (code 3, son nom sur la sortie d'erreur)
# Code de sortie : 0 si tout passe ; sinon 3 (le nom du fichier en échec est écrit sur la sortie d'erreur).
# Note : 20261028_signalements_app n'est pas dans la liste : ses tables sont dans clone_3_tables.sql ; seules ses fonctions sont jouées.
set -u
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=55435
TITRES=0
LISTE_TITRES=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --avec-titres) TITRES=1; LISTE_TITRES="1 2 3 4"; shift ;;
    --titres)
      [ $# -ge 2 ] || { echo "--titres demande une liste (1,2,3)" >&2; exit 2; }
      case "$2" in
        *[!0-9,]*|""|,*|*,|*,,*) echo "liste --titres refusée : « $2 » (attendu : 1,2,3)" >&2; exit 2 ;;
      esac
      TITRES=1; LISTE_TITRES="$(echo "$2" | tr ',' ' ')"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
MIGRATIONS="$RACINE/supabase/migrations"
export PGOPTIONS="-c check_function_bodies=off" PGCLIENTENCODING=UTF8
P="psql -h 127.0.0.1 -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

LISTE="20261108_espaces_1_siege 20261108_espaces_2_equipe 20261108_espaces_3_habillage 20261108_questionnaires
20261109_epcf_moyennes_anonymat 20261109_habillage 20261109_registre_qualite 20261110_epcf_moyennes_seuil_3
20261110_profils_email_stagiaires 20261111_espaces_4_donnees
20261110_navigation_unique_1_reglages 20261110_navigation_unique_2_menage 20261111_navigation_unique_3_phase2
20261110_conservation"
# Ordre de la production : la navigation unique (phase 2 : fiches_suivi disparaît), puis la conservation des données (Qualiopi Q5 :
# anonymiser_promo, etat_anonymisation_promo et _anonymiser_stagiaire disparaissent, les fonctions effacer_* arrivent), puis les titres.
if [ "$TITRES" = 1 ]; then
  for n in $LISTE_TITRES; do
    f="$(ls "$MIGRATIONS"/20261112_titres_${n}_*.sql 2>/dev/null | grep -v '_retour\.sql$' | head -n 1)"
    [ -n "$f" ] || { echo "migration introuvable : 20261112_titres_${n}_*" >&2; exit 3; }
    LISTE="$LISTE $(basename "$f" .sql)"
  done
fi

# Prérequis : les cinq fonctions de 20261028_signalements_app (signaler_probleme, que le registre qualité appelle, et ses
# quatre voisines), absentes des clones. On joue la seule partie « fonctions » de la migration (de la section 4 à la fin) :
# ses tables et ses règles sont déjà dans clone_3_tables.sql, et la migration entière rétablirait des règles d'avant le
# lot 4 (elles citent is_founder), ce que la couverture de la preuve des rôles refuse. Pas comptée dans la suite.
sed -n '/^-- 4\. Envoyer/,$p' "$MIGRATIONS/20261028_signalements_app.sql" | $P -1 || { echo "échec : 20261028_signalements_app (fonctions)" >&2; exit 3; }
# Prérequis aussi : notes_stats_groupe (20261023, remplacée telle quelle, sans dépendance), absente des clones et réécrite par
# la migration 20261112_titres_2. Pas comptée dans la suite.
$P -1 -f "$MIGRATIONS/20261023_notes_stats_en_formation.sql" || { echo "échec : 20261023_notes_stats_en_formation" >&2; exit 3; }
N=0
for f in $LISTE; do
  $P -1 -f "$MIGRATIONS/$f.sql" || { echo "échec : $f" >&2; exit 3; }
  N=$((N + 1))
done
# Droits propres à la production, que les clones ne portent pas (écarts de la base locale constatés le 10/11 et le 11/11) :
# 1. registre_qualite : en production, service_role y écrit (la preuve du registre le contrôle) ; ici la table naît de la
#    migration 20261109 sans ce droit, d'où un 42501. Pas de droit général sur les tables : la preuve des questionnaires
#    exige que service_role n'ait aucun droit sur les siennes.
# 2. epcf_moyennes : en production, un visiteur (anon) n'a pas le droit de l'exécuter. Ici la fonction naît de la
#    migration 20261109 sans droits explicites, donc PostgreSQL laisse EXECUTE à PUBLIC. On retire PUBLIC et anon et on
#    donne authenticated et service_role. (Ne pas poser « revoke ... on functions from public » par défaut : les
#    fonctions que les preuves créent dans pg_temp deviendraient inutilisables par les rôles testés.)
$P <<'SQL' || { echo "échec : droits de la production" >&2; exit 3; }
grant all on public.registre_qualite to service_role;
revoke all on function public.epcf_moyennes(text) from public, anon;
grant execute on function public.epcf_moyennes(text) to authenticated, service_role;
SQL
# 3. Droits de l'émargement du 23/10 (20261023_emargement.sql), absents des clones : emargement_signer_formateur et emargement_rouvrir
#    n'y existent pas, et les autres fonctions y gardent l'exécution par défaut (PUBLIC). En production : emargement_jour_paris,
#    emargement_trace_valide et emargement_feuille sont internes (aucun droit pour anon, PUBLIC ni authenticated), les autres
#    fonctions s'exécutent par authenticated seulement. On rejoue, tels quels, les deux create function manquants et les revoke /
#    grant du fichier (extraits par motif, pas par numéro de ligne). Q5 recrée emargement_signer, _annoter et _clore par create or
#    replace, qui garde ces droits.
{
  awk '/^create function public\.emargement_(signer_formateur|rouvrir)\(/ {f=1} f {print} /^\$function\$;/ {f=0}' "$MIGRATIONS/20261023_emargement.sql"
  awk '/^(revoke all on function public\.emargement_(jour_paris|ouvrir)|grant execute on function public\.emargement_ouvrir)/ {f=1} f {print} f && /;[ ]*$/ {f=0}' "$MIGRATIONS/20261023_emargement.sql"
} | $P -1 || { echo "échec : droits de l'émargement" >&2; exit 3; }
echo "OK : suite rejouée ($N migrations)"
