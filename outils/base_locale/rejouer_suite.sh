#!/usr/bin/env bash
# Rejoue, sur la base locale reconstruite (reconstruire.sh), les migrations du dépôt postérieures au lot 4, dans l'ordre
# où la production les a reçues, pour que les preuves SQL se jouent sur un état identique à la production.
#
# Usage : outils/base_locale/rejouer_suite.sh [--port 55435] [--avec-titres] [--titres 1,2,3[,...]] [--autonomie 1|1,2] [--production] [--production-2711]
#   --port         port de la base locale (défaut 55435)
#   --avec-titres  ajoute ensuite les migrations 20261112_titres_1 à _4 (chantier titres et droits à la carte) ; vaut --titres 1,2,3,4
#   --titres       ajoute ensuite les migrations 2026111?_titres_<n>_* (n de 1 à 9, date quelconque du 10 au 19/11) dans l'ordre de
#                  la liste ; un fichier manquant arrête le script (code 3, son nom sur la sortie d'erreur)
#   --autonomie    après les contacts, joue 20261114_autonomie_1_traces (1), puis 20261114_autonomie_2_version (2) avec
#                  -v version=2026-11-14 (la version des conditions en production) ; 2 demande 1
#   --production   l'état de la production au 16/11, dans l'ordre où elle l'a reçu : titres 1, 2, 3 (11/11), contacts,
#                  20261111_conservation_direction (11/11, après les contacts), titres 5 (11/11) et 6 (13/11), puis
#                  --autonomie 1,2 (14/11), puis 20261114_restes_1_conditions et 20261114_restes_2_truncate (14/11, après
#                  l'e-learning : restes_1 contrôle la version de l'autonomie), puis 20261114_jury_resultats (14/11), puis
#                  20261115_titres_7_correctifs puis 20261115_titres_8_apercu (appliquées le 14/11), puis
#                  20261115_titres_9_catalogue (appliquée le 16/11) (sortie : 30 migrations) ;
#                  ne se combine ni avec
#                  --titres ni avec --avec-titres
#   --production-2711  l'état de la production au 27/11 : --production puis, dans cet ordre (fusion eaffaf61 du 21/11 pour les
#                  contacts, le journal des titres et les conditions ; 4a661c28 du 23/11 et b5535cd5 du 24/11 pour les EPCF du CCP2) :
#                  20261115_contact_1_annuaire, _1b_fermeture, _2_demandes, _3_absences, 20261115_contact_demo,
#                  20261116_contact_4_correctifs, 20261118_contact_5_donnees_sensibles, 20261112_titres_4_journal (journal des droits,
#                  appliqué le 21/11 après la 9), 20261121_conditions_version (aucune variable psql : la garde exige la version
#                  publiée 2026-11-14 et la remplace par 2026-11-21 ; autonomie_2 reste à 2026-11-14), 20261123_epcf_ccp2 et
#                  20261124_epcf_ccp2_reseau (sortie : 41 migrations) ; ne se combine ni avec --titres ni avec --avec-titres
# Sans --titres, --autonomie ni --production : la suite d'avant (14 migrations, plus les deux des contacts : 16).
# Code de sortie : 0 si tout passe ; sinon 3 (le nom du fichier en échec est écrit sur la sortie d'erreur).
# Note : 20261028_signalements_app n'est pas dans la liste : ses tables sont dans clone_3_tables.sql ; seules ses fonctions sont jouées.
set -u
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=55435
TITRES=0
LISTE_TITRES=""
AUTONOMIE=""
PRODUCTION=0
P2711=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --avec-titres) TITRES=1; LISTE_TITRES="1 2 3 4"; shift ;;
    --titres)
      [ $# -ge 2 ] || { echo "--titres demande une liste (1,2,3)" >&2; exit 2; }
      case "$2" in
        *[!1-9,]*|""|,*|*,|*,,*|*[0-9][0-9]*) echo "liste --titres refusée : « $2 » (attendu : des numéros de 1 à 9, ainsi 1,2,3)" >&2; exit 2 ;;
      esac
      TITRES=1; LISTE_TITRES="$(echo "$2" | tr ',' ' ')"; shift 2 ;;
    --autonomie)
      [ $# -ge 2 ] || { echo "--autonomie demande 1 ou 1,2" >&2; exit 2; }
      case "$2" in
        1|1,2) AUTONOMIE="$2" ;;
        *) echo "liste --autonomie refusée : « $2 » (attendu : 1 ou 1,2)" >&2; exit 2 ;;
      esac
      shift 2 ;;
    --production) PRODUCTION=1; AUTONOMIE="1,2"; shift ;;
    --production-2711) PRODUCTION=1; P2711=1; AUTONOMIE="1,2"; shift ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
[ "$PRODUCTION" = 1 ] && [ "$TITRES" = 1 ] && { echo "--production fixe déjà les titres : ne pas y ajouter --titres ni --avec-titres" >&2; exit 2; }
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
# Le nom d'une migration des titres (2026111?_titres_<n>_*, hors retour), ou l'arrêt (code 3) si elle manque.
titre() {
  local f
  f="$(ls "$MIGRATIONS"/2026111?_titres_"$1"_*.sql 2>/dev/null | grep -v '_retour\.sql$' | head -n 1)"
  [ -n "$f" ] || { echo "migration introuvable : 2026111?_titres_$1_*" >&2; exit 3; }
  basename "$f" .sql
}
CONTACTS="20261113_contacts_centre 20261113_contacts_centre_2_montpellier"
if [ "$PRODUCTION" = 1 ]; then
  # L'ordre réel de la production (fusions dans main du 11/11 au 13/11) : titres 1 à 3 (18 h 29), contacts (19 h 35), conservation de
  # la direction (21 h 07 : elle lit geste_centre de la migration 2 des titres), titres 5 (21 h 23), titres 6 (13/11).
  for n in 1 2 3; do LISTE="$LISTE $(titre $n)" || exit 3; done
  LISTE="$LISTE $CONTACTS 20261111_conservation_direction"
  for n in 5 6; do LISTE="$LISTE $(titre $n)" || exit 3; done
else
  if [ "$TITRES" = 1 ]; then
    for n in $LISTE_TITRES; do LISTE="$LISTE $(titre "$n")" || exit 3; done
  fi
  # Après les titres en production (11/11) : les contacts rattachés à un centre. Indépendante des titres (sa règle restrictive
  # ne cite que lieu_courant()), elle est jouée dans les deux cas.
  LISTE="$LISTE $CONTACTS"
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
# Après les contacts (14/11) : l'e-learning, lot 1. La migration 2 lit la version des conditions dans la variable psql « version »
# (celle de la production : 2026-11-14, VERSION_CONDITIONS de js/legal-data.js).
if [ -n "$AUTONOMIE" ]; then
  $P -1 -f "$MIGRATIONS/20261114_autonomie_1_traces.sql" || { echo "échec : 20261114_autonomie_1_traces" >&2; exit 3; }
  N=$((N + 1))
  if [ "$AUTONOMIE" = "1,2" ]; then
    $P -v version=2026-11-14 -1 -f "$MIGRATIONS/20261114_autonomie_2_version.sql" >/dev/null || { echo "échec : 20261114_autonomie_2_version" >&2; exit 3; }
    N=$((N + 1))
  fi
fi
# Production seulement, après l'e-learning (14/11, petits restes) : restes_1 (conditions_version_publiee, accepter_conditions durcie ; elle
# contrôle que la version exigée par l'autonomie ne dépasse pas la publiée), puis restes_2 (TRUNCATE retiré à anon et authenticated).
if [ "$PRODUCTION" = 1 ]; then
  for f in 20261114_restes_1_conditions 20261114_restes_2_truncate; do
    $P -1 -f "$MIGRATIONS/$f.sql" >/dev/null || { echo "échec : $f" >&2; exit 3; }
    N=$((N + 1))
  done
fi
# Production seulement, après les restes (14/11, c1883cc5) : les résultats du jury (une table, deux règles, un déclencheur ; elle demande
# imposer_promo_du_stagiaire et geste_promo, présents).
if [ "$PRODUCTION" = 1 ]; then
  $P -1 -f "$MIGRATIONS/20261114_jury_resultats.sql" >/dev/null || { echo "échec : 20261114_jury_resultats" >&2; exit 3; }
  N=$((N + 1))
fi
# Production seulement, après le jury : les migrations 7 (correctifs D1, D4, D5, M4, M5, M7) et 8 (aperçu par titre, mes_titres en aperçu,
# titres_ajustables, journal_present) des titres, appliquées en production le 14/11, dans cet ordre.
if [ "$PRODUCTION" = 1 ]; then
  $P -1 -f "$MIGRATIONS/20261115_titres_7_correctifs.sql" >/dev/null || { echo "échec : 20261115_titres_7_correctifs" >&2; exit 3; }
  N=$((N + 1))
  $P -1 -f "$MIGRATIONS/20261115_titres_8_apercu.sql" >/dev/null || { echo "échec : 20261115_titres_8_apercu" >&2; exit 3; }
  N=$((N + 1))
fi
# Production seulement, après la 8 : la migration 9 des titres (catalogue de six titres du réseau, lecture des titres d'un centre par le
# siège), appliquée en production le 16/11.
if [ "$PRODUCTION" = 1 ]; then
  $P -1 -f "$MIGRATIONS/20261115_titres_9_catalogue.sql" >/dev/null || { echo "échec : 20261115_titres_9_catalogue" >&2; exit 3; }
  N=$((N + 1))
fi
# Production du 27/11 seulement, après la 9 des titres : les contacts (21/11), le journal des droits, les conditions 2026-11-21, les
# EPCF du CCP2 (23 et 24/11). Avant les droits ci-dessous, pour qu'ils portent sur l'état final des fonctions.
if [ "$P2711" = 1 ]; then
  for f in 20261115_contact_1_annuaire 20261115_contact_1b_fermeture 20261115_contact_2_demandes 20261115_contact_3_absences            20261115_contact_demo 20261116_contact_4_correctifs 20261118_contact_5_donnees_sensibles 20261112_titres_4_journal            20261121_conditions_version 20261123_epcf_ccp2 20261124_epcf_ccp2_reseau; do
    $P -1 -f "$MIGRATIONS/$f.sql" >/dev/null || { echo "échec : $f" >&2; exit 3; }
    N=$((N + 1))
  done
fi
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
