# Génère le bloc de fragments de 20261112_titres_5_fermetures.sql (argument aller) et de son retour (argument retour) à partir d un seul
# tableau (fonction, [(ancien, nouveau), ...]) ; le retour est l aller avec anciens et nouveaux échangés. Si l un change, régénérer
# l autre : coller la sortie à la place du bloc do $migration$ de chaque fichier. Usage : python outils/generer_fragments_titres_5.py aller|retour
# Contrairement à la migration 2 de l étape 1, une fonction absente arrête la migration (rien n est changé) : ces fonctions existent toutes.
import sys

P = "public."
T = []  # (signature, [(ancien, nouveau), ...])


def f(sig, *pairs):
    T.append((sig, list(pairs)))


# Partie A : personne ne se nomme soi-même à la direction (le fondateur, hors aperçu, excepté).
LIGNE_DIRECTION = "    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.\n"
f("inviter_compte(text, text, integer, integer, integer)",
  (LIGNE_DIRECTION,
   "    -- Personne ne se nomme soi-même à la direction (le fondateur, hors aperçu, excepté).\n"
   "    if v_email = v_moi and not est_fondateur() then\n"
   "      raise exception 'invitation: Vous ne pouvez pas vous nommer vous-même à la direction.' using errcode = '42501';\n"
   "    end if;\n" + LIGNE_DIRECTION))


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
    sys.stdout.write(bloc(mode == "retour", "titres_5_fermetures_retour" if mode == "retour" else "titres_5_fermetures"))
