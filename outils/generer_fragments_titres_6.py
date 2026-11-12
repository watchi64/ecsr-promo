# Génère le bloc de fragments de 20261112_titres_6_gestion.sql (argument aller) et de son retour (argument retour) à partir d un seul
# tableau (fonction, [(ancien, nouveau), ...]) ; le retour est l aller avec anciens et nouveaux échangés. Si l un change, régénérer
# l autre : coller la sortie à la place du bloc do $migration$ de chaque fichier. Usage : python outils/generer_fragments_titres_6.py aller|retour
# Une fonction absente arrête la migration (rien n est changé) : retirer_titre existe depuis la migration 5, que la 6 demande.
# Partie B : retirer_titre cesse de ne retirer que les titres fixes. La ligne « Ce titre ne se retire pas encore ici » et les trois contrôles
# de la migration 5 (droit, jamais sur soi) laissent la place à l aide _refus_titre, la même que pour donner (les phrases des titres fixes
# restent celles de la migration 5 : le groupe retrait reste vert à l identique).
import sys

P = "public."
T = []  # (signature, [(ancien, nouveau), ...])


def f(sig, *pairs):
    T.append((sig, list(pairs)))


f("retirer_titre(text, bigint, integer)",
  # Deux variables pour recevoir le refus.
  ("  v_n integer;\nbegin\n  if v_moi is null then\n",
   "  v_n integer;\n  v_etat text;\n  v_phrase text;\nbegin\n  if v_moi is null then\n"),
  # La ligne de refus des titres non fixes, le droit et « jamais sur soi » : une seule aide.
  ("""  -- Les titres non fixes se retireront à la migration 6 (cette ligne seule est alors remplacée).
  if not v_fixe then
    raise exception 'titres: Ce titre ne se retire pas encore ici.';
  end if;
  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
  if v_niveau = 'reseau' then
    v_lieu := null;
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est requis.';
  end if;
  -- Le droit : Formateur, la direction du centre (ou le fondateur) ; Direction de centre, le siège (ou le fondateur) ; Siège, le fondateur.
  if v_niveau = 'promo' then
    if not geste_centre(v_lieu, 'formateurs.nommer') then
      raise exception 'titres: Réservé à la direction du centre.' using errcode = '42501';
    end if;
  elsif v_niveau = 'centre' then
    if not geste_reseau('directions.nommer') then
      raise exception 'titres: Réservé au siège.' using errcode = '42501';
    end if;
  else
    if not est_fondateur() then
      raise exception 'titres: Réservé au fondateur.' using errcode = '42501';
    end if;
  end if;
  -- Jamais sur soi : la seule exception est la directrice qui forme, qui retire son propre titre FIXE Formateur (et non un titre de promo
  -- quelconque : un titre non fixe, retirable à la migration 6, reste soumis à la règle) ; le fondateur (hors aperçu) retire ce qu'il veut.
  if v_email = v_moi and (v_niveau <> 'promo' or not v_fixe) and not est_fondateur() then
    raise exception 'titres: Vous ne pouvez pas retirer votre propre titre.' using errcode = '42501';
  end if;
""",
   """  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
  if v_niveau = 'reseau' then
    v_lieu := null;
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est requis.';
  end if;
  -- Les règles du § 7 (titre d'un autre centre, droit, jamais plus que soi, jamais sur soi) sont celles de donner_titre : une seule aide.
  -- Retirer obéit aux mêmes règles que donner : on ne retire que ce qu'on pourrait donner (le verrou des titres non fixes mis à part).
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(p_titre_id, v_lieu, v_email, 'retirer') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
"""))


def bloc(inverse, nom):
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

    return f"""do $migration$
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
    mode = sys.argv[1]
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdout.write(bloc(mode == "retour", "titres_6_gestion_retour" if mode == "retour" else "titres_6_gestion"))
