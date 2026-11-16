# Génère les blocs de 20261115_titres_8_apercu.sql (argument aller) et de son retour (argument retour) à partir d une seule source.
# Usage : python outils/generer_fragments_titres_8.py aller|retour ; coller la sortie à la place de la partie générée de chaque fichier
# (entre les lignes « -- debut du bloc genere » et « -- fin du bloc genere »). Ne jamais modifier ces blocs à la main.
#
# Deux sortes de changements, même mécanique que generer_fragments_titres_7.py :
#   - mes_titres, remplacée EN ENTIER (create or replace, même signature, même retour) : l aller écrit le texte nouveau, posé ici ; le
#     retour remet le texte de la migration 6, relu dans supabase/migrations/20261112_titres_6_gestion.sql (la migration 7 n y touche
#     pas). Garde de dérive en tête de chaque bloc (le corps en vigueur est celui qu on remplace, retours chariot ignorés) ;
#   - les fragments (tableau T) des six fonctions de la migration 2 qui lisent l aperçu : chaque ancien est relu dans
#     supabase/migrations/20261112_titres_2_gestes.sql, où il doit figurer exactement une fois dans la définition de sa fonction (sinon le
#     générateur s arrête) ; le retour est l aller avec anciens et nouveaux échangés.
# Hors du bloc, écrits à la main : dans l aller, les fonctions nouvelles (apercu_titre, _case_apercu, _apercu_fixe, posées AVANT le bloc :
# les fonctions en SQL qui les appellent sont validées à leur création ; titres_ajustables, journal_present) ; dans le retour, l en-tête,
# la garde D5 (juste après le lock_timeout) et la suppression des fonctions nouvelles (après le bloc).
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
MIGRATION_2 = RACINE / "supabase" / "migrations" / "20261112_titres_2_gestes.sql"
MIGRATION_6 = RACINE / "supabase" / "migrations" / "20261112_titres_6_gestion.sql"
P = "public."

# Fonctions remplacées en entier : (nom, signature des types, corps nouveau entre $f$ et $f$, en-tête identique à celui de la migration 6).
ENTIERES = []


def entiere(nom, types, corps):
    ENTIERES.append((nom, types, corps))


# M10 : en aperçu, mes_titres rend le titre simulé, jamais les vrais titres du fondateur. Hors aperçu : le texte de la migration 6.
entiere("mes_titres", "", """
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_apercu text;
  v_niveau text;
  v_titre bigint;
  v_lieu integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  -- En aperçu (M10) : le titre simulé, jamais les vrais titres de la personne. Aperçu stagiaire : aucun titre. Aperçu formateur,
  -- direction ou siège : une ligne, le titre choisi par l'en-tête x-apercu-titre (apercu_titre) ou, sans lui, le titre fixe du niveau, sur
  -- le centre affiché (aucun au réseau) et, pour un titre de promo, la promo affichée.
  v_apercu := apercu_role();
  if v_apercu = 'stagiaire' then
    return;
  end if;
  if v_apercu in ('formateur', 'direction', 'siege') then
    v_niveau := case v_apercu when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end;
    v_titre := coalesce(apercu_titre(), titre_fixe(v_niveau));
    v_lieu := case when v_niveau = 'reseau' then null else lieu_courant() end;
    return query
      select t.id, t.nom, t.niveau, v_lieu, l.nom,
             case when v_niveau = 'promo' then array_remove(array[promo_courante()], null) end, _cases_effectives(t.id)
        from titres t
        left join lieux l on l.id = v_lieu
       where t.id = v_titre;
    return;
  end if;
  return query
    select g.titre_id, t.nom, t.niveau, g.lieu, l.nom, g.promos, _cases_effectives(t.id)
      from (select x.titre_id, x.lieu,
                   case when x.role = 'formateur' then array_agg(x.promo_id order by x.promo_id) end as promos
              from (select a.titre_id, a.role, a.promo_id,
                           case a.role when 'formateur' then (select p.lieu_id from promos p where p.id = a.promo_id)
                                       when 'direction' then a.lieu_id end as lieu
                      from affectations a
                     where lower(a.email) = v_moi) x
             group by x.titre_id, x.role, x.lieu) g
      join titres t on t.id = g.titre_id
      left join lieux l on l.id = g.lieu
     order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, l.nom collate "C", t.nom collate "C", t.id;
end;
""")

# Fragments : (nom, signature des types, [(ancien, nouveau), ...]).
T = []


def f(nom, types, *pairs):
    T.append((nom, types, list(pairs)))


# Les cases en aperçu : le plafond, sauf si l'en-tête x-apercu-titre désigne un titre admis (apercu_titre) : ses cases, bornées au plafond.
f("case_promo", "integer, text",
  ("case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then pg.plafond else 0 end",
   "case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then _case_apercu(p_page, pg.plafond) else 0 end"))
f("case_centre", "integer, text",
  ("case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then pg.plafond else 0 end",
   "case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then _case_apercu(p_page, pg.plafond) else 0 end"))
f("case_reseau", "text",
  ("case when apercu.role = 'siege' then pg.plafond else 0 end",
   "case when apercu.role = 'siege' then _case_apercu(p_page, pg.plafond) else 0 end"))
# Les titres fixes en aperçu : faux quand l'en-tête désigne un titre non fixe (gestes définitifs et droits sans page).
f("formateur_fixe", "integer",
  ("when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)\n",
   "when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and _apercu_fixe()\n"))
f("direction_fixe", "integer",
  ("when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)\n",
   "when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and _apercu_fixe()\n"))
f("siege_fixe", "",
  ("when apercu.role is not null then apercu.role = 'siege'\n",
   "when apercu.role is not null then apercu.role = 'siege' and _apercu_fixe()\n"))


def definition(fichier, nom):
    """La définition de « create function public.<nom>( » à la première ligne « $f$; » qui suit, une seule dans le fichier."""
    src = fichier.read_text(encoding="utf-8").replace("\r\n", "\n")
    motif = re.compile(r"^create function public\." + re.escape(nom) + r"\(.*?^\$f\$;$", re.S | re.M)
    trouves = motif.findall(src)
    if len(trouves) != 1:
        sys.exit(f"{nom} : {len(trouves)} définition(s) dans {fichier.name} (une seule attendue)")
    return trouves[0]


def corps_de(defn):
    debut = defn.index("\nas $f$") + len("\nas $f$")
    fin = defn.rindex("$f$;")
    return defn[debut:fin]


def entete_de(defn):
    return defn[: defn.index("\nas $f$")]


def controler_fragments():
    """Chaque ancien figure exactement une fois dans la définition de sa fonction (migration 2), et le nouveau n'y figure pas."""
    for nom, _types, pairs in T:
        defn = definition(MIGRATION_2, nom)
        for ancien, nouveau in pairs:
            if defn.count(ancien) != 1:
                sys.exit(f"{nom} : le fragment « {ancien.strip()} » figure {defn.count(ancien)} fois dans {MIGRATION_2.name} (une seule attendue)")
            if nouveau in defn:
                sys.exit(f"{nom} : le nouveau texte figure déjà dans {MIGRATION_2.name}")


def bloc_entieres(inverse, nom_migration):
    morceaux = []
    for nom, types, corps_nouveau in ENTIERES:
        ancienne = definition(MIGRATION_6, nom)
        corps_ancien = corps_de(ancienne)
        entete = entete_de(ancienne).replace("create function ", "create or replace function ", 1)
        attendu, pose = (corps_nouveau, corps_ancien) if inverse else (corps_ancien, corps_nouveau)
        sig = f"{P}{nom}({types})"
        morceaux.append(f"""-- {sig} : garde de dérive (le corps en vigueur est celui qu'on remplace), puis le texte {'de la migration 6' if inverse else 'nouveau'}.
do $garde_{nom.strip('_')}$
declare
  v_corps text;
begin
  if to_regprocedure('{sig}') is null then
    raise exception '{nom_migration} : {sig} n''existe pas ; rien n''est changé';
  end if;
  select replace(p.prosrc, E'\\r', '') into v_corps from pg_proc p where p.oid = to_regprocedure('{sig}');
  if v_corps is distinct from $attendu${attendu}$attendu$ then
    raise exception '{nom_migration} : le corps de {sig} n''est pas celui attendu ; rien n''est changé';
  end if;
end $garde_{nom.strip('_')}$;

{entete}
as $f${pose}$f$;
""")
    return "\n".join(morceaux)


def bloc_fragments(inverse, nom_migration):
    fonctions = ",\n".join(f"    '{P}{n}({t})'" for n, t, _ in T)
    de, anc, nou = [], [], []
    for i, (_n, _t, pairs) in enumerate(T, 1):
        for a, n in pairs:
            if inverse:
                a, n = n, a
            de.append(i)
            anc.append(a)
            nou.append(n)

    def arr(xs, d):
        return ",\n".join(f"${d}${x}${d}$" for x in xs)

    return f"""
do $migration$
declare
  v_fonctions text[] := array[
{fonctions}];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[{', '.join(map(str, de))}];
  v_anciens text[] := array[
{arr(anc, 'ancien')}];
  v_nouveaux text[] := array[
{arr(nou, 'nouveau')}];
  f integer;
  i integer;
  v_oid regprocedure;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : une fonction absente, un fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    v_oid := to_regprocedure(v_fonctions[f]);
    if v_oid is null then
      raise exception '{nom_migration} : % n''existe pas ; rien n''est changé', v_fonctions[f];
    end if;
    v_def := pg_get_functiondef(v_oid);
    for i in 1..cardinality(v_de) loop
      if v_de[i] <> f then continue; end if;
      v_ancien := v_anciens[i];
      v_nouveau := v_nouveaux[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\\n', E'\\r\\n');
        v_nouveau := replace(v_nouveau, E'\\n', E'\\r\\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception '{nom_migration} : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
"""


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("aller", "retour"):
        sys.exit("usage : python outils/generer_fragments_titres_8.py aller|retour")
    controler_fragments()
    inverse = sys.argv[1] == "retour"
    nom = "titres_8_apercu_retour" if inverse else "titres_8_apercu"
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdout.write("-- debut du bloc genere (outils/generer_fragments_titres_8.py " + sys.argv[1] + ")\n")
    sys.stdout.write(bloc_entieres(inverse, nom))
    sys.stdout.write(bloc_fragments(inverse, nom))
    sys.stdout.write("-- fin du bloc genere\n")
