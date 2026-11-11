# Génère supabase/migrations/20261112_titres_3_regles.sql et son retour. Les expressions d'origine sont RELUES dans les fichiers de
# migration (la dernière migration qui crée ou modifie la règle fait foi), jamais écrites de mémoire ; les nouvelles en sont
# déduites en remplaçant l'appel d'un ancien prédicat (formateur_courant, equipe_courante, redacteur_contenus...) par le geste qui
# lui correspond. Usage : python outils/generer_regles_titres_3.py   (écrit les deux fichiers, en LF)
import glob
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(RACINE, "supabase", "migrations")

F = "(select public.formateur_courant())"
E = "(select public.equipe_courante())"
R = "(select public.redacteur_contenus())"
PC = "(select public.promo_courante())"


def geste(code):
    return "(select public.geste_promo(%s, '%s'))" % (PC, code)


def membre_ou(code):
    return "(select public.membre_stagiaire(%s)) or %s" % (PC, geste(code))


# nom de la règle -> (table, [(ancien texte, nouveau texte)]) ; None = règle de lecture « P » (remplacée en entier)
REGLES = {}


def r(table, noms, *subs):
    for n in noms.split():
        REGLES[n] = (table, list(subs))


# Planning et passages
r("agenda_events", "agenda_events_ecriture", (F, geste("planning.modifier")))
r("planning_entries", "planning_entries_ecriture", (F, geste("planning.modifier")))
r("planning_half_meta", "planning_half_meta_ecriture", (F, geste("planning.modifier")))
r("planning_jours_off", "planning_jours_off_ecriture", (F, geste("planning.modifier")))
r("passages", "passages_ajout passages_modification passages_suppression", (F, geste("planning.modifier")))
LECTURES_P = {
    "agenda_select_authenticated": ("agenda_events", "planning.lire"),
    "planning_entries_select_all": ("planning_entries", "planning.lire"),
    "planning_half_meta_select_all": ("planning_half_meta", "planning.lire"),
    "planning_jours_off_select_all": ("planning_jours_off", "planning.lire"),
    "emargement_seances_select": ("emargement_seances", "emargement.lire"),
    "stagiaires_select_all": ("stagiaires", "stagiaires.lire"),
    "passages_select_all": ("passages", "stagiaires.lire"),
    "passages_audit_select": ("passages_audit", "stagiaires.lire"),
    "qcm_examens_select": ("qcm_examens", "notes.lire"),
    "themes_progression_select": ("themes_progression", "notes.lire"),
}
# Émargement
r("emargement_lignes", "emargement_lignes_lecture", (E, geste("emargement.lire")))
r("emargement_formateurs", "emargement_formateurs_lecture", (E, geste("emargement.lire")))
# Stagiaires
r("stagiaires", "stagiaires_ajout stagiaires_modification", (E, geste("stagiaires.gerer")))
r("stagiaires", "stagiaires_suppression", (F, geste("stagiaires.supprimer")))
r("stagiaires_prive", "stagiaires_prive_lecture", (E, geste("stagiaires.lire")))
r("user_profiles", "user_profiles_lecture", (E, geste("stagiaires.lire")))
r("user_profiles", "user_profiles_suppression", (E, geste("stagiaires.gerer")))
r("conditions_acceptations", "conditions_acceptations_lecture", (E, geste("stagiaires.lire")))
r("effacements_journal", "effacements_journal_lecture", (E, geste("stagiaires.lire")))
# Bénévoles, auto-écoles, suivis
for t in ("auto_ecoles", "benevoles", "benevole_suivi"):
    r(t, t + "_lecture", (E, geste("benevoles.lire")))
    r(t, t + "_ajout " + t + "_modification", (F, geste("benevoles.gerer")))
r("auto_ecoles", "auto_ecoles_suppression", (F, geste("benevoles.gerer")))
r("benevole_suivi", "benevole_suivi_suppression", (F, geste("benevoles.gerer")))
r("benevoles", "benevoles_suppression", (F, geste("benevoles.purger")))
# Notes et examens
# notes_stagiaires_visibles() rend les fiches non masquées de la promo à tout compte qui y a accès (les camarades d'un stagiaire) :
# sans fiche dans la promo et sans la case Notes, elle ne doit rien ouvrir. La clause n'est donc jouée que pour un membre de la promo.
r("evaluations", "evaluations_lecture", (E, geste("notes.lire")),
  ("stagiaire_id in (select public.notes_stagiaires_visibles())",
   "((select public.membre_stagiaire(%s)) and stagiaire_id in (select public.notes_stagiaires_visibles()))" % PC))
r("evaluations", "evaluations_ecriture", (F, geste("notes.saisir")))
r("evaluations_audit", "evaluations_audit_lecture", (E, geste("notes.lire")))
for t in ("epcf_evaluations", "epcf_livrets", "dp_dossiers", "fiches_suivi", "qcm_attempts"):
    r(t, t + "_lecture", (E, geste("notes.lire")))
    r(t, " ".join(t + s for s in ("_ajout", "_modification", "_suppression")), (F, geste("notes.saisir")))
for t in ("qcm_examens", "themes_progression"):
    r(t, " ".join(t + s for s in ("_ajout", "_modification", "_suppression")), (F, geste("notes.saisir")))
# Cours et contenus
CL3 = "((select public.formateur_courant()) or (select public.direction_courante()) or (select public.est_siege()))"
CL2 = "((select public.formateur_courant()) or (select public.est_siege()))"
r("cours", "cours_lecture", (CL3, geste("contenus.lire_internes")))
r("cours_versions", "cours_versions_lecture", (CL3, geste("contenus.lire_internes")))
r("cours", "cours_modification", (CL2, geste("contenus.rediger")))
r("cours_versions", "cours_versions_ajout", (CL2, geste("contenus.rediger")))
r("qcm_questions", "qcm_questions_ecriture", (R, geste("contenus.rediger")))
r("qcm_options", "qcm_options_ecriture", (R, geste("contenus.rediger")))
r("objects", "cours_images_ecriture qcm_images_admin_insert qcm_images_admin_update qcm_images_admin_delete", (R, geste("contenus.rediger")))
for t in ("qcm", "themes", "competences", "ressources"):
    r(t, t + "_ecriture", (F, geste("referentiel.modifier")))
r("qcm_signalements", "qcm_signalements_lecture qcm_signalements_modification qcm_signalements_suppression", (F, geste("contenus.traiter")))
r("qcm_signalement_instruction", "qcm_signalement_instruction_lecture", (F, geste("contenus.traiter")))
r("qcm_ia_brouillons", "qcm_ia_brouillons_lecture", (F, geste("contenus.traiter")))
# Réglages, promos, fiches internes
r("settings", "settings_ecriture", (E, geste("modules.modifier")), (F, geste("reglages.modifier")))
r("contacts", "contacts_ecriture", (E, geste("fiches_internes.ecrire")))
r("profs", "profs_ecriture", (E, geste("fiches_internes.ecrire")))
# promos_modification, affectations_ajout et affectations_retrait : réécrites en entier plus bas
ENTIER = {
    "promos_modification": ("promos", "public.geste_promo(id, 'promo.renommer')", "public.geste_promo(id, 'promo.renommer')"),
}
AFF = ("(role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id), 'formateurs.nommer'))"
       " or (role = 'direction' and (select public.geste_reseau('directions.nommer')))"
       " or (role = 'siege' and (select public.est_fondateur()))")
ATTENDU = 93


def ignorer_chaine(s, i):
    # i pointe sur une apostrophe : rend l'indice après la chaîne
    i += 1
    while i < len(s):
        if s[i] == "'":
            if i + 1 < len(s) and s[i + 1] == "'":
                i += 2
                continue
            return i + 1
        i += 1
    raise ValueError("chaîne non fermée")


def bloc_parenthese(s, i):
    # s[i] == '(' : rend (contenu sans les parenthèses extérieures, indice après la parenthèse fermante)
    assert s[i] == "("
    prof = 0
    j = i
    while j < len(s):
        c = s[j]
        if c == "'":
            j = ignorer_chaine(s, j)
            continue
        if c == "(":
            prof += 1
        elif c == ")":
            prof -= 1
            if prof == 0:
                return s[i + 1:j], j + 1
        j += 1
    raise ValueError("parenthèse non fermée")


def sans_commentaires(s):
    out = []
    for ligne in s.split("\n"):
        k = 0
        res = ""
        while k < len(ligne):
            if ligne[k] == "'":
                e = ignorer_chaine(ligne, k)
                res += ligne[k:e]
                k = e
                continue
            if ligne.startswith("--", k):
                break
            res += ligne[k]
            k += 1
        out.append(res)
    return "\n".join(out)


def lire_regles():
    """Rend {nom: (table, using, check)} d'après les fichiers, dans l'ordre des noms de fichier."""
    etat = {}
    fichiers = sorted(f for f in glob.glob(os.path.join(MIG, "*.sql"))
                      if not f.endswith("_retour.sql") and os.path.basename(f) < "20261112")
    for f in fichiers:
        with open(f, encoding="utf-8", newline="") as fh:
            txt = sans_commentaires(fh.read().replace("\r\n", "\n"))
        if "policy" not in txt:
            continue
        for m in re.finditer(r'\b(create|alter|drop)\s+policy\s+(if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+([\w."]+)', txt):
            action, nom, table = m.group(1), m.group(3).strip('"'), m.group(4)
            if action == "drop":
                etat.pop((table.split(".")[-1], nom), None)
                continue
            fin = txt.find(";", m.end())
            # le point-virgule peut figurer dans une chaîne : on avance en respectant les chaînes
            j = m.end()
            while j < len(txt) and txt[j] != ";":
                if txt[j] == "'":
                    j = ignorer_chaine(txt, j)
                else:
                    j += 1
            corps = txt[m.end():j]
            using = check = None
            for mm in re.finditer(r"\b(using|with\s+check)\s*\(", corps):
                debut = mm.end() - 1
                contenu, _ = bloc_parenthese(corps, debut)
                if mm.group(1) == "using":
                    using = contenu
                else:
                    check = contenu
            cle = (table.split(".")[-1], nom)
            if action == "alter":
                ancien = etat.get(cle)
                if ancien is None:
                    raise SystemExit("alter policy d'une règle inconnue : %s (%s)" % (nom, os.path.basename(f)))
                etat[cle] = (using if using is not None else ancien[0], check if check is not None else ancien[1], os.path.basename(f))
            else:
                etat[cle] = (using, check, os.path.basename(f))
    return {nom: (t, u, c, src) for (t, nom), (u, c, src) in etat.items()}


def norme(s):
    return re.sub(r"\s+", " ", s).strip()


def remplacer(texte, ancien, nouveau, nom):
    # L'ancien appel est cherché à l'identique, blancs normalisés ; il doit figurer au moins une fois.
    pat = re.compile(r"\s*".join(re.escape(x) for x in ancien.split()))
    res, n = pat.subn(lambda _: nouveau, texte)
    if n == 0:
        raise SystemExit("règle %s : %s introuvable dans l'expression d'origine" % (nom, ancien))
    return res


def nouvelles(defs):
    sortie = []  # (nom, table, using_d_origine, check_d_origine, using_nouveau, check_nouveau, source)
    noms = list(REGLES) + list(LECTURES_P) + list(ENTIER) + ["affectations_ajout", "affectations_retrait"]
    for nom in noms:
        if nom not in defs:
            raise SystemExit("règle %s introuvable dans les migrations" % nom)
        table, u, c, src = defs[nom]
        if nom in LECTURES_P:
            attendu_t, code = LECTURES_P[nom]
            if table != attendu_t:
                raise SystemExit("règle %s : table %s au lieu de %s" % (nom, table, attendu_t))
            if norme(u) != "promo_id = (select public.promo_courante())" and norme(u) != "promo_id = (select promo_courante())":
                raise SystemExit("règle %s : lecture P attendue, trouvé %s" % (nom, norme(u)))
            un = "promo_id = %s and (%s)" % (PC, membre_ou(code))
            sortie.append((nom, table, u, c, un, None, src))
            continue
        if nom in ENTIER:
            t, un, cn = ENTIER[nom]
            sortie.append((nom, table, u, c, un, cn, src))
            continue
        if nom == "affectations_ajout":
            sortie.append((nom, table, u, c, None, AFF, src))
            continue
        if nom == "affectations_retrait":
            sortie.append((nom, table, u, c, AFF, None, src))
            continue
        t, subs = REGLES[nom]
        if table != t:
            raise SystemExit("règle %s : table %s au lieu de %s" % (nom, table, t))
        un = norme(u) if u is not None else None
        cn = norme(c) if c is not None else None
        for ancien, nouveau in subs:
            if un is not None and ancien in un or (un is not None and norme(ancien) in un):
                un = remplacer(un, ancien, nouveau, nom)
            if cn is not None and (ancien in cn or norme(ancien) in cn):
                cn = remplacer(cn, ancien, nouveau, nom)
        if un == (norme(u) if u is not None else None) and cn == (norme(c) if c is not None else None):
            raise SystemExit("règle %s : rien n'a changé" % nom)
        sortie.append((nom, table, u, c, un, cn, src))
    return sortie


def alter(nom, table, u, c):
    t = table if "." in table else "public." + table
    if t == "public.objects":
        t = "storage.objects"
    s = "alter policy %s on %s" % (nom, t)
    if u is not None:
        s += "\n  using (%s)" % u
    if c is not None:
        s += "\n  with check (%s)" % c
    return s + ";\n"


def main():
    defs = lire_regles()
    lst = nouvelles(defs)
    if len(lst) != ATTENDU:
        raise SystemExit("%d règles au lieu de %d" % (len(lst), ATTENDU))
    garde = ",\n    ".join("('%s', '%s')" % ("storage" if t == "objects" else "public", n) for n, t, *_ in [(x[0], x[1]) for x in lst])
    # la garde cite aussi la table
    lignes_garde = []
    for nom, table, *_ in lst:
        schema = "storage" if table == "objects" else "public"
        lignes_garde.append("('%s', '%s', '%s')" % (schema, table, nom))
    garde = ",\n    ".join(lignes_garde)

    def fichier(sens):
        lignes = []
        if sens == "aller":
            lignes.append("""-- Titres et droits à la carte, étape 1, migration 3 : les 93 règles de sécurité passent par les gestes (geste_promo, geste_centre,
-- geste_reseau, membre_stagiaire, posés par la migration 2). Chaque règle garde son nom, sa commande et ses rôles (alter policy, jamais
-- drop + create) ; seul l'ancien prédicat (formateur_courant, equipe_courante, redacteur_contenus, direction_courante, est_siege...) est
-- remplacé par le geste qui lui correspond, appelé en sous-requête (select ...) pour n'être calculé qu'une fois par requête.
-- Pour les titres fixes d'aujourd'hui (Formateur, Direction de centre, Siège) chaque règle donne exactement les mêmes lignes qu'avant
-- (preuve du lot 4 inchangée) ; un titre non fixe n'ouvre que ce que ses cases ouvrent.
--   * Lectures « P » (toute personne qui a accès à la promo affichée) : membre stagiaire de la promo, ou geste de lecture de la page.
--   * Clauses « M » (sa fiche, son adresse, son identifiant) et clauses du fondateur : inchangées.
--   * Réglages : la clé « modules » suit le geste modules.modifier, les clés navigation_v2 et emargement_actif restent au fondateur.
--   * Affectations : formateurs.nommer pour une ligne de formateur, directions.nommer pour une ligne de direction ; la ligne de siège
--     reste au fondateur.
-- Garde : chaque règle nommée doit exister, sinon la migration s'arrête avec son nom et ne change rien.
-- Marche arrière : 20261112_titres_3_regles_retour.sql (remet l'expression d'origine, relue dans les fichiers de migration).
-- Généré par outils/generer_regles_titres_3.py : ne pas éditer à la main.
set local lock_timeout = '3s';
""")
        else:
            lignes.append("""-- Marche arrière de 20261112_titres_3_regles.sql : chacune des 93 règles retrouve l'expression d'origine (celle de la dernière
-- migration qui la définit, relue dans les fichiers : 20261001_multi_promo_2_cloisonnement, 20261023_emargement, 20261028_roles_3_regles,
-- 20261110_profils_email_stagiaires). Même garde que l'aller : une règle absente arrête la migration avec son nom.
-- Généré par outils/generer_regles_titres_3.py : ne pas éditer à la main.
set local lock_timeout = '3s';
""")
        lignes.append("""do $garde$
declare
  v_regle record;
begin
  for v_regle in
    select g.schema_name, g.table_name, g.policy_name
      from (values
    @@GARDE@@
      ) as g(schema_name, table_name, policy_name)
     where not exists (select 1 from pg_policies p
                        where p.schemaname = g.schema_name and p.tablename = g.table_name and p.policyname = g.policy_name)
  loop
    raise exception 'titres_3: la règle % sur %.% n''existe pas', v_regle.policy_name, v_regle.schema_name, v_regle.table_name;
  end loop;
end
$garde$;
""".replace("@@GARDE@@", garde))
        for nom, table, uo, co, un, cn, src in lst:
            if sens == "aller":
                lignes.append("-- %s.%s\n%s" % (table, nom, alter(nom, table, un, cn)))
            else:
                lignes.append("-- %s.%s (%s)\n%s" % (table, nom, src, alter(nom, table, uo, co)))
        return "\n".join(lignes)

    for sens, nomf in (("aller", "20261112_titres_3_regles.sql"), ("retour", "20261112_titres_3_regles_retour.sql")):
        with open(os.path.join(MIG, nomf), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(fichier(sens))
    print("OK : %d règles" % len(lst))


if __name__ == "__main__":
    main()
