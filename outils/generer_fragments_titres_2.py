# Génère la partie B de 20261112_titres_2_gestes.sql (argument aller) et de son retour (argument retour) à partir d un seul tableau
# (fonction, ancien, nouveau) ; le retour est l aller avec anciens et nouveaux échangés. Si l un change, régénérer l autre : coller la sortie
# à la place du bloc do $migration$ de chaque fichier. Usage : python outils/generer_fragments_titres_2.py aller|retour
import sys

P = "public."
T = []  # (signature, [(ancien, nouveau), ...])


def f(sig, *pairs):
    T.append((sig, list(pairs)))


f("a_une_affectation(text)",
  ("(select public.equipe_courante())", "(select public.geste_promo(promo_courante(), 'stagiaires.gerer'))"))
f("accepter_brouillon_ia(bigint, text, text, text, jsonb)",
  ("if not formateur_courant() then", "if not geste_promo(promo_courante(), 'contenus.traiter') then"))
f("rejeter_brouillon_ia(bigint)",
  ("if not formateur_courant() then", "if not geste_promo(promo_courante(), 'contenus.traiter') then"))
f("anonymiser_promo()",
  ("if not equipe_courante() then", "if not geste_promo(promo_courante(), 'anonymiser') then"))
f("etat_anonymisation_promo()",
  ("if not equipe_courante() then", "if not geste_promo(promo_courante(), 'anonymiser') then"))
f("anonymiser_stagiaire(integer)",
  ("if not equipe_courante() then", "if not geste_promo(promo_courante(), 'anonymiser') then"))
old_p = "if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then"
new_p = "if not geste_promo(p_promo, 'anonymiser') then"
f("anonymiser_promo(integer)", (old_p, new_p))
f("etat_anonymisation_promo(integer)", (old_p, new_p))
f("benevoles_a_purger()",
  ("where formateur_courant()", "where (select public.geste_promo(promo_courante(), 'benevoles.purger'))"))
old_l = "if not coalesce(est_direction(p_lieu), false) then"
new_l = "if not geste_centre(p_lieu, 'donnees.purger') then"
f("benevoles_a_purger(integer)", (old_l, new_l))
f("purger_benevoles(integer[])",
  ("if not formateur_courant() then", "if not geste_promo(promo_courante(), 'benevoles.purger') then"))
f("purger_benevoles(integer[], integer)", (old_l, new_l))
f("venues_benevoles()",
  ("where equipe_courante()", "where (select public.geste_promo(promo_courante(), 'benevoles.lire'))"))
f("notes_stagiaires_visibles()",
  ("       equipe_courante()\n", "       (select public.geste_promo(promo_courante(), 'notes.lire'))\n"))
f("epcf_moyennes(text)",
  ("(select public.equipe_courante())", "(select public.geste_promo(promo_courante(), 'notes.lire'))"))
f("notes_stats_groupe()",
  ("  select jsonb_build_object(\n    'n_lignes'",
   "  select case when membre_stagiaire(promo_courante()) or geste_promo(promo_courante(), 'notes.lire') then jsonb_build_object(\n    'n_lignes'"),
  ("(select min(moy) from par_stagiaire)\n  );\n", "(select min(moy) from par_stagiaire)\n  ) end;\n"))
f("set_date_naissance(integer, date)",
  ("if not (equipe_courante() or p_stagiaire_id = my_stagiaire_id()) then",
   "if not (geste_promo(promo_courante(), 'stagiaires.gerer') or coalesce(p_stagiaire_id = my_stagiaire_id(), false)) then"))
f("emargement_feuille(bigint, boolean)",
  ("if p_formateur and not formateur_courant() then", "if p_formateur and not geste_promo(promo_courante(), 'emargement.tenir') then"))
f("emargement_ouvrir(text, text, text)",
  ("if not formateur_courant() then", "if not geste_promo(promo_courante(), 'emargement.tenir') then"))
f("emargement_signer(bigint, integer, text)",
  ("elsif formateur_courant() then", "elsif geste_promo(promo_courante(), 'emargement.tenir') then"))
f("is_admin()", ("select formateur_courant();", "select geste_promo(promo_courante(), 'contenus.traiter');"))
f("is_prof()", ("select formateur_courant();", "select geste_promo(promo_courante(), 'contenus.traiter');"))
f("creer_promo(integer, text, date, date)",
  ("or not est_direction(p_lieu_id) then", "or not geste_centre(p_lieu_id, 'promos.gerer') then"))
f("modifier_dates_promo(integer, date, date)",
  ("or not est_direction(lieu_de_promo(p_promo_id)) then", "or not geste_centre(lieu_de_promo(p_promo_id), 'promos.gerer') then"))
f("regler_habillage_centre(integer, text, boolean)",
  ("or not coalesce(est_direction(p_lieu_id), false) then", "or not geste_centre(p_lieu_id, 'reglages.modifier') then"))
f("regler_habillage_reseau(text)",
  ("or not coalesce(est_siege(), false) then", "or not geste_reseau('reglages.modifier') then"))
f("creer_centre(text)",
  ("if not coalesce((select est_siege()), false) then", "if not coalesce((select geste_reseau('centres.creer')), false) then"))
f("regler_affectations_formateur(text, integer, integer[], integer)",
  ("or not coalesce(est_direction(p_lieu_id), false) then", "or not geste_centre(p_lieu_id, 'formateurs.nommer') then"))
f("inviter_compte(text, text, integer, integer, integer)",
  ("if v_promo_fiche is null or not (est_formateur(v_promo_fiche) or est_direction(lieu_de_promo(v_promo_fiche))) then",
   "if v_promo_fiche is null or not geste_promo(v_promo_fiche, 'stagiaires.gerer') then"),
  ("if v_promo is null or not est_direction(lieu_de_promo(v_promo)) then",
   "if v_promo is null or not geste_centre(lieu_de_promo(v_promo), 'formateurs.nommer') then"),
  ("    if not est_siege() then\n", "    if not geste_reseau('directions.nommer') then\n"))
assert len(T) == 29, len(T)


def bloc(inverse, nom):
    fonctions = ",\n".join(f"    '{P}{s}'::regprocedure" for s, _ in T)
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

    return f"""do $migration$
declare
  v_fonctions regprocedure[] := array[
{fonctions}];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[{', '.join(map(str, de))}];
  v_anciens text[] := array[
{arr(anc, 'ancien')}];
  v_nouveaux text[] := array[
{arr(nou, 'nouveau')}];
  f integer;
  i integer;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : un seul fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    v_def := pg_get_functiondef(v_fonctions[f]);
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
        raise exception '{nom} : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
"""


if __name__ == "__main__":
    mode = sys.argv[1]
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdout.write(bloc(mode == "retour", "titres_2_gestes_retour" if mode == "retour" else "titres_2_gestes"))
