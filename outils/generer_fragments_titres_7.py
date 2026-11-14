# Génère les blocs de 20261115_titres_7_correctifs.sql (argument aller) et de son retour (argument retour) à partir d une seule source.
# Usage : python outils/generer_fragments_titres_7.py aller|retour ; coller la sortie à la place de la partie générée de chaque fichier
# (entre les lignes « -- debut du bloc genere » et « -- fin du bloc genere »). Ne jamais modifier ces blocs à la main.
#
# Deux sortes de changements :
#   - les fonctions remplacées EN ENTIER (create or replace, même signature, même retour) : l aller écrit le texte nouveau, posé ici ; le
#     retour remet le texte de la migration 6, relu dans supabase/migrations/20261112_titres_6_gestion.sql (jamais réécrit de mémoire).
#     Chaque bloc commence par une garde de dérive : le corps en vigueur doit être exactement celui qu on remplace (retours chariot
#     ignorés), sinon la migration s arrête sans rien changer. Les droits d exécution ne changent pas (create or replace les garde ; le
#     revoke qui suit les redit, sans effet sur une fonction déjà fermée) ;
#   - les fragments (tableau T, alimenté par la partie B, puis C) : même mécanique que generer_fragments_titres_6.py, le retour est
#     l aller avec anciens et nouveaux échangés.
# Partie A (D1, décision de Timy du 12/11, étendue à la création le 14/11) : _refus_gestion, règles du § 5.D du plan.
# Partie B (D4) : ajuster_titre (verrou de ligne, phrase de l index) et donner_titre (verrou partagé), en fragments ; l index
# titres_version_unique et sa garde sont écrits à la main dans la migration, hors du bloc généré.
# Partie C (M4, M5, M7) : donner_titre (fiche formateur et is_admin au seul titre fixe Formateur), creer_titre et ajuster_titre (un nom ne
# reprend pas celui d'un titre de l'autre portée), en fragments, dans le même bloc.
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
MIGRATION_6 = RACINE / "supabase" / "migrations" / "20261112_titres_6_gestion.sql"
P = "public."

# Fonctions remplacées en entier : (nom, signature des types, corps nouveau entre $f$ et $f$, en-tête identique à celui de la migration 6).
ENTIERES = []


def entiere(nom, types, corps):
    ENTIERES.append((nom, types, corps))


entiere("_refus_gestion", "text, integer, jsonb", """
declare
  v_page text;
begin
  -- 1. Le fondateur, hors aperçu : permis.
  if coalesce(est_fondateur(), false) then
    return null;
  end if;
  if p_lieu_id is not null and p_niveau in ('promo', 'centre') then
    if p_niveau = 'promo' then
      -- 2. Titre d'un centre, niveau promo : Équipe sur Modifier dans ce centre.
      if case_centre(p_lieu_id, 'equipe') <> 2 then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
    else
      -- 3. Titre d'un centre, niveau centre : Équipe sur Modifier dans ce centre, ou le siège fixe ; des cases au plus égales à celles de
      --    l'appelant, sauf direction fixe du centre ou siège fixe. Un titre non fixe du réseau (Directions de centre : Modifier) n'y
      --    touche plus : il donne et retire les titres existants, il ne les crée ni ne les ajuste.
      if case_centre(p_lieu_id, 'equipe') <> 2 and not coalesce(siege_fixe(), false) then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
      if not coalesce(direction_fixe(p_lieu_id), false) and not coalesce(siege_fixe(), false) then
        v_page := _depasse(p_cases, _cases_appelant('centre', p_lieu_id));
      end if;
    end if;
  elsif p_niveau in ('promo', 'centre') then
    -- 4. Titre du réseau de niveau promo ou centre (sans centre), créé, ajusté ou supprimé : le siège fixe seul.
    if not coalesce(siege_fixe(), false) then
      return 'titres: Réservé au siège.';
    end if;
  else
    -- 5. Titre du réseau de niveau réseau : Directions de centre sur Modifier ; des cases au plus égales à celles de l'appelant, sauf
    --    siège fixe.
    if case_reseau('directions') <> 2 then
      return 'titres: Réservé au réseau.';
    end if;
    if not coalesce(siege_fixe(), false) then
      v_page := _depasse(p_cases, _cases_appelant('reseau', null));
    end if;
  end if;
  if v_page is not null then
    return 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').';
  end if;
  return null;
end;
""")

# Fragments : (signature, [(ancien, nouveau), ...]). Chaque ancien est un texte de la migration 6, trouvé exactement une fois dans la
# définition en vigueur (retours chariot suivis).
T = []


def f(sig, *pairs):
    T.append((sig, list(pairs)))


# Partie B (D4, décision de Timy du 12/11) : une seule version de centre par titre du réseau. L'index titres_version_unique (posé hors
# du bloc généré) est la garantie ; le verrou de ligne sur le titre du réseau rend le second ajustement simultané juste (il attend, voit la
# version et la modifie) ; si l'index se déclenche quand même, une phrase dit pourquoi. donner_titre prend un verrou partagé sur le même
# titre : un don et un ajustement simultanés s'attendent, le porteur finit sur la version du centre quand elle existe.
f("ajuster_titre(bigint, integer, text, jsonb)",
  ("""  v_bascules integer := 0;
""", """  v_bascules integer := 0;
  v_contrainte text;
"""),
  ("""  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version""", """  -- D4 : un seul ajustement à la fois par titre ; le second attend, puis voit la version que le premier a créée.
  perform 1 from titres where id = p_titre_id for update;
  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version"""),
  ("""  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object(""", """  exception when unique_violation then
    -- D4 : la version du centre posée entre-temps par un autre chemin (index titres_version_unique) n'est pas un nom en double.
    get stacked diagnostics v_contrainte = constraint_name;
    if v_contrainte = 'titres_version_unique' then
      raise exception 'titres: Ce titre vient d''être ajusté pour ce centre par une autre personne : rouvrez-le, puis réessayez.';
    end if;
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object("""),
  # Partie C (M7) : un nom nouveau, après les deux contrôles du droit (un appelant sans droit n'apprend pas qu'un nom existe).
  ("""  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
""", """  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  -- M7 : un nom nouveau ne reprend pas celui d'un titre de l'autre portée. Le nom se pose dans un centre (titre de centre, ou version d'un
  -- titre du réseau) : aucun titre du réseau non fixe ne le porte ; au réseau : aucun titre créé par un centre. Le titre lui-même, sa racine
  -- et ses versions sont écartés (une version garde le nom de son titre du réseau).
  if v_nom is not null then
    if v_lieu is not null then
      if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and lower(r.nom) = lower(v_nom)
                    and coalesce(r.origine_id, r.id) <> t.racine) then
        raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
      end if;
    elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and lower(c.nom) = lower(v_nom)
                     and coalesce(c.origine_id, c.id) <> t.racine) then
      raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
    end if;
  end if;
"""))

f("donner_titre(text, bigint, integer, integer[], integer)",
  ("""  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id""",
   """  -- D4 : un don attend l'ajustement en cours du même titre (et inversement), puis voit sa version.
  perform 1 from titres where id = p_titre_id for share;
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id"""),
  # Partie C (M4) : une fiche formateur ne se relie qu'au titre fixe Formateur, le seul titre fixe de niveau promo ; le refus vient après
  # celui du droit (_refus_titre), avant toute écriture.
  ("""  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
""", """  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
  -- M4 : une fiche formateur ne se relie qu'au titre fixe Formateur.
  if p_prof_id is not null and not (t.niveau = 'promo' and t.fixe) then
    raise exception 'titres: Une fiche formateur ne se relie qu''au titre Formateur.';
  end if;
"""),
  # Partie C (M4, M5) : seul le titre fixe Formateur fait un compte de formateur (is_admin vrai, fiche reliée) ; un titre de promo non fixe
  # transforme un orphelin ou crée un profil comme un titre de centre (rôle prof, is_admin faux). is_admin d'un profil existant n'est jamais
  # relevé ni abaissé (la règle de _orphelin_en_personnel).
  ("""  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo', case when t.niveau = 'promo' then p_prof_id end, v_moi);""",
   """  -- M4, M5 : seul le titre fixe Formateur fait un compte de formateur (is_admin vrai, fiche reliée).
  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo' and t.fixe, case when t.niveau = 'promo' and t.fixe then p_prof_id end, v_moi);"""),
  ("""    if t.niveau = 'promo' then
      v_cree := _profil_formateur(""", """    if t.niveau = 'promo' and t.fixe then
      v_cree := _profil_formateur("""))

# Partie C (M7) : creer_titre, même règle de nom qu'ajuster_titre, après le refus du droit, avant l'écriture.
f("creer_titre(bigint, text, integer)",
  ("""  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par)""", """  -- M7 : un nom ne reprend pas celui d'un titre de l'autre portée (après le droit : un appelant sans droit n'apprend pas qu'un nom
  -- existe). Un titre de centre : aucun titre du réseau non fixe ne porte ce nom ; un titre du réseau : aucun titre créé par un centre.
  if v_lieu is not null then
    if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and lower(r.nom) = lower(v_nom)) then
      raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
    end if;
  elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and lower(c.nom) = lower(v_nom)) then
    raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
  end if;
  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par)"""))


def texte_migration_6(nom, types):
    """La définition de la migration 6 : de « create function public.<nom>( » à la première ligne « $f$; » qui suit."""
    src = MIGRATION_6.read_text(encoding="utf-8").replace("\r\n", "\n")
    motif = re.compile(r"^create function public\." + re.escape(nom) + r"\(.*?^\$f\$;$", re.S | re.M)
    trouves = motif.findall(src)
    if len(trouves) != 1:
        sys.exit(f"{nom} : {len(trouves)} définition(s) dans {MIGRATION_6.name} (une seule attendue)")
    return trouves[0]


def corps_de(definition):
    debut = definition.index("\nas $f$") + len("\nas $f$")
    fin = definition.rindex("$f$;")
    return definition[debut:fin]


def entete_de(definition):
    return definition[: definition.index("\nas $f$")]


def bloc_entieres(inverse, nom_migration):
    morceaux = []
    for nom, types, corps_nouveau in ENTIERES:
        ancienne = texte_migration_6(nom, types)
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

revoke all on function {sig} from public, anon, authenticated, service_role;
""")
    return "\n".join(morceaux)


def bloc_fragments(inverse, nom):
    if not T:
        return ""
    fonctions = ",\n".join(f"    '{P}{s}'" for s, _ in T)
    de, anc, nou = [], [], []
    for i, (s, pairs) in enumerate(T, 1):
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
      raise exception '{nom} : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception '{nom} : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
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
        sys.exit("usage : python outils/generer_fragments_titres_7.py aller|retour")
    inverse = sys.argv[1] == "retour"
    nom = "titres_7_correctifs_retour" if inverse else "titres_7_correctifs"
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdout.write("-- debut du bloc genere (outils/generer_fragments_titres_7.py " + sys.argv[1] + ")\n")
    sys.stdout.write(bloc_entieres(inverse, nom))
    sys.stdout.write(bloc_fragments(inverse, nom))
    sys.stdout.write("-- fin du bloc genere\n")
