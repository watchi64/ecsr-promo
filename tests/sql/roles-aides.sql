-- Aides communes aux preuves du lot 4 (rôles et portées). outils/assembler_repetition_roles.mjs les colle au début
-- du fichier assemblé, au niveau du script, avant le bloc do de la preuve. Table temporaire « preuve » et fonctions
-- de pg_temp : elles ne vivent que le temps de la session, et la levée finale de la preuve les annule avec le reste.
-- Rien de ce qui sort d'ici ne porte d'email : les détails rendent des états SQL (sqlstate), des noms de
-- contrainte, des identifiants, des booléens ou des tableaux de rôles.

drop table if exists pg_temp.preuve;
create temp table preuve (num serial, groupe text, libelle text, etat text, detail text,
  qui text, ctx text, tbl text, op text);

-- Identifiants (sub) des vrais jetons, par email en minuscules : une preuve qui incarne des comptes réels les relève
-- dans auth.users et les range ici ; contexte() les ajoute aux claims, et auth.uid() rend alors ce qu'il rend dans
-- l'app. Vide par défaut : sans ligne, pas de sub (personnages fictifs, preuve de l'étape 1).
drop table if exists pg_temp.jetons;
create temp table jetons (email text primary key, sub text);

-- Contrôle compté : réussi si p_ok est vrai (nul vaut échec). Groupe « plan » : contrôle demandé par le plan de
-- l'étape ; le verdict le nomme même quand tout est vert.
create or replace function pg_temp.verifier(p_groupe text, p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve (groupe, libelle, etat, detail)
  values (p_groupe, p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''));
$f$;

-- Contrôle d'une case de matrice : personnage, contexte, table, opération ; le libellé les réunit.
create or replace function pg_temp.verifier_m(p_groupe text, p_qui text, p_ctx text, p_tbl text, p_op text, p_ok boolean,
  p_detail text default '')
returns void language sql as $f$
  insert into preuve (groupe, libelle, etat, detail, qui, ctx, tbl, op)
  values (p_groupe, concat_ws(', ', p_qui, p_ctx, p_tbl) || ' : ' || p_op,
          case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''), p_qui, p_ctx, p_tbl, p_op);
$f$;

-- Contrôle d'une valeur : réussi si l'obtenu égale l'attendu (nul égale nul) ; le détail montre les deux, l'obtenu
-- d'abord (le verdict tronque les détails longs).
create or replace function pg_temp.attendre(p_groupe text, p_libelle text, p_obtenu text, p_attendu text)
returns void language sql as $f$
  select pg_temp.verifier(p_groupe, p_libelle, p_obtenu is not distinct from p_attendu,
    format('obtenu %s ; attendu %s', coalesce(p_obtenu, 'nul'), coalesce(p_attendu, 'nul')));
$f$;

-- Ligne d'information : figure au verdict, ne compte jamais (ni réussie, ni en échec).
create or replace function pg_temp.informer(p_libelle text, p_detail text)
returns void language sql as $f$
  insert into preuve (groupe, libelle, etat, detail) values ('information', p_libelle, 'info', coalesce(p_detail, ''));
$f$;

-- Contexte de requête d'un personnage, sans changer de rôle : le jeton (email, et sub s'il est connu dans jetons) et
-- les en-têtes x-promo-id et x-apercu-role, chacun seulement s'il n'est pas nul, comme PostgREST les pose.
create or replace function pg_temp.contexte(p_email text, p_promo text, p_apercu text)
returns void language plpgsql as $f$
declare v_sub text;
begin
  if p_email is not null then
    select j.sub into v_sub from pg_temp.jetons j where j.email = lower(p_email);
  end if;
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else jsonb_strip_nulls(jsonb_build_object('email', p_email, 'role', 'authenticated', 'sub', v_sub))::text end, true);
  perform set_config('request.headers',
    case when p_promo is null and p_apercu is null then ''
         else jsonb_strip_nulls(jsonb_build_object('x-promo-id', p_promo, 'x-apercu-role', p_apercu))::text end, true);
end $f$;

-- Personnage : son contexte de requête, puis le rôle de la base qu'il a derrière PostgREST (anon sans email).
create or replace function pg_temp.incarner(p_email text, p_promo text, p_apercu text)
returns void language plpgsql as $f$
begin
  perform pg_temp.contexte(p_email, p_promo, p_apercu);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

-- Retour au propriétaire, sans contexte de requête.
create or replace function pg_temp.proprio()
returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
end $f$;

-- Valeur (en texte) qu'une requête rend à un personnage, ou « ERREUR <sqlstate> ». Rend la main au propriétaire.
create or replace function pg_temp.valeur(p_email text, p_promo text, p_apercu text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.incarner(p_email, p_promo, p_apercu);
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERREUR ' || sqlstate;
  end;
  perform pg_temp.proprio();
  return v;
end $f$;

-- La même, jouée par le propriétaire avec le contexte du personnage posé : pour les fonctions internes, qui n'ont
-- aucun droit d'exécution public.
create or replace function pg_temp.valeur_proprio(p_email text, p_promo text, p_apercu text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.contexte(p_email, p_promo, p_apercu);
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERREUR ' || sqlstate;
  end;
  perform pg_temp.proprio();
  return v;
end $f$;

-- Attendu calculé par le propriétaire, sans contexte, en SQL direct sur les données. Si la requête échoue (table
-- absente), « incalculable », qui n'égale aucune valeur obtenue : un attendu qu'on ne sait pas calculer ne laisse
-- jamais passer un contrôle.
create or replace function pg_temp.calcul(p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.proprio();
  execute p_sql into v;
  return v;
exception when others then
  return 'incalculable (ERREUR ' || sqlstate || ')';
end $f$;

-- Une requête modèle jouée pour chaque valeur d'une liste (%s : la valeur), par un personnage ou, avec p_proprio,
-- par le propriétaire dans son contexte : « 1=true 2=false … ».
create or replace function pg_temp.sur_chaque(p_email text, p_promo text, p_apercu text, p_modele text,
  p_valeurs integer[], p_proprio boolean default false)
returns text language plpgsql as $f$
declare x integer; r text := '';
begin
  foreach x in array coalesce(p_valeurs, '{}') loop
    r := r || case when r = '' then '' else ' ' end || x || '=' || coalesce(
      case when p_proprio then pg_temp.valeur_proprio(p_email, p_promo, p_apercu, format(p_modele, x))
           else pg_temp.valeur(p_email, p_promo, p_apercu, format(p_modele, x)) end, 'nul');
  end loop;
  return r;
end $f$;

-- Une requête jouée par un personnage pour chaque promo affichée (en-tête x-promo-id) : « 1=true 2=false … ».
create or replace function pg_temp.sur_chaque_promo(p_email text, p_apercu text, p_sql text, p_promos integer[])
returns text language plpgsql as $f$
declare x integer; r text := '';
begin
  foreach x in array coalesce(p_promos, '{}') loop
    r := r || case when r = '' then '' else ' ' end || x || '='
         || coalesce(pg_temp.valeur(p_email, x::text, p_apercu, p_sql), 'nul');
  end loop;
  return r;
end $f$;

-- Une requête jouée pour chaque valeur d'en-tête x-apercu-role (nul : sans en-tête, écrit « aucun »), par un
-- personnage ou, avec p_proprio, par le propriétaire dans son contexte : « stagiaire=… formateur=… ».
create or replace function pg_temp.selon_apercu(p_email text, p_promo text, p_sql text, p_apercus text[],
  p_proprio boolean default false)
returns text language plpgsql as $f$
declare a text; r text := '';
begin
  foreach a in array coalesce(p_apercus, '{}') loop
    r := r || case when r = '' then '' else ' ' end || coalesce(a, 'aucun') || '=' || coalesce(
      case when p_proprio then pg_temp.valeur_proprio(p_email, p_promo, a, p_sql)
           else pg_temp.valeur(p_email, p_promo, a, p_sql) end, 'nul');
  end loop;
  return r;
end $f$;

-- L'attendu de sur_chaque ou sur_chaque_promo quand chaque valeur doit rendre la même chose.
create or replace function pg_temp.partout(p_valeurs integer[], p_attendu text)
returns text language sql as $f$
  select coalesce(string_agg(x || '=' || p_attendu, ' ' order by o), '')
    from unnest(p_valeurs) with ordinality u(x, o);
$f$;

-- Écriture tentée par un personnage (ou par le propriétaire, avec p_proprio), TOUJOURS annulée : elle se fait dans
-- une sous-transaction que la fonction lève elle-même. Rend « OK <lignes> », suivi, si p_constat est donné, de la
-- valeur que relit le propriétaire dans la même sous-transaction (« aucune » si vide) ; ou « REFUS <sqlstate> »,
-- suivi du nom de la contrainte en cause s'il y en a une.
create or replace function pg_temp.ecrire(p_email text, p_promo text, p_apercu text, p_sql text,
  p_constat text default null, p_proprio boolean default false)
returns text language plpgsql as $f$
declare n bigint; v text; c text;
begin
  begin
    if p_proprio then
      perform pg_temp.proprio();
    else
      perform pg_temp.incarner(p_email, p_promo, p_apercu);
    end if;
    execute p_sql;
    get diagnostics n = row_count;
    perform pg_temp.proprio();
    if p_constat is not null then
      execute p_constat into v;
      v := ' ' || coalesce(nullif(v, ''), 'aucune');
    end if;
    raise exception using errcode = 'P0001', message = 'OK ' || n || coalesce(v, '');
  exception when others then
    get stacked diagnostics c = constraint_name;
    if sqlstate = 'P0001' and sqlerrm like 'OK %' then return sqlerrm; end if;
    return 'REFUS ' || sqlstate || coalesce(' ' || nullif(c, ''), '');
  end;
end $f$;

-- La même, par le propriétaire, sans contexte de requête.
create or replace function pg_temp.ecrire_proprio(p_sql text, p_constat text default null)
returns text language sql as $f$
  select pg_temp.ecrire(null, null, null, p_sql, p_constat, true);
$f$;

-- Écriture tentée par un personnage dans une sous-transaction TOUJOURS annulée, encadrée en propriétaire : p_prep
-- (avant, facultatif : faire de la place, lever un obstacle sans rapport avec la règle testée), p_attendu (avant
-- l'écriture, facultatif : la valeur attendue, calculée en SQL direct sur les données), p_constat (après, facultatif).
-- Rend {attendu, obtenu} : l'obtenu vaut « OK <lignes> <constat> », « REFUS <sqlstate> [contrainte] » (erreur de
-- l'écriture), ou « ERREUR <sqlstate> (<étape>) » si la préparation, l'attendu ou le constat a échoué ; un attendu
-- qui n'a pas pu être calculé vaut nul (et ne laisse jamais passer un contrôle).
create or replace function pg_temp.tenter(p_email text, p_promo text, p_apercu text, p_prep text, p_attendu text,
  p_sql text, p_constat text)
returns text[] language plpgsql as $f$
declare v_att text; n bigint; v text; c text; v_etape text := 'préparation';
begin
  begin
    perform pg_temp.proprio();
    if p_prep is not null then execute p_prep; end if;
    v_etape := 'attendu';
    if p_attendu is not null then
      execute p_attendu into v_att;
      v_att := coalesce(v_att, 'nul');
    end if;
    v_etape := 'écriture';
    perform pg_temp.incarner(p_email, p_promo, p_apercu);
    execute p_sql;
    get diagnostics n = row_count;
    v_etape := 'constat';
    perform pg_temp.proprio();
    if p_constat is not null then execute p_constat into v; end if;
    raise exception using errcode = 'P0001', message = 'OK ' || n || coalesce(' ' || v, '');
  exception when others then
    get stacked diagnostics c = constraint_name;
    if sqlstate = 'P0001' and sqlerrm like 'OK %' then return array[v_att, sqlerrm]; end if;
    if v_etape <> 'écriture' then
      return array[v_att, format('ERREUR %s (%s)', sqlstate, v_etape)];
    end if;
    return array[v_att, 'REFUS ' || sqlstate || coalesce(' ' || nullif(c, ''), '')];
  end;
end $f$;

-- Essai en propriétaire, le contexte du personnage posé (les valeurs par défaut qui lisent le jeton ou les en-têtes
-- prennent alors la valeur qu'elles auraient pour lui), annulé aussitôt : p_prep, puis p_sql, puis la valeur que rend
-- p_mesure (sur la ligne écrite). Rend cette valeur, ou « ERREUR <sqlstate> ».
create or replace function pg_temp.essai_proprio(p_email text, p_promo text, p_apercu text, p_prep text, p_sql text,
  p_mesure text)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform pg_temp.proprio();
    if p_prep is not null then execute p_prep; end if;
    perform pg_temp.contexte(p_email, p_promo, p_apercu);
    execute p_sql;
    execute p_mesure into v;
    raise exception using errcode = 'P0001', message = 'MESURE ' || coalesce(v, 'nul');
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'MESURE %' then
      perform pg_temp.proprio();
      return substr(sqlerrm, 8);
    end if;
    perform pg_temp.proprio();
    return 'ERREUR ' || sqlstate;
  end;
end $f$;

-- Un modèle de requête rempli : chaque {clé} de p_jetons (objet JSON de textes SQL déjà écrits en littéraux) est
-- remplacé par sa valeur. Une clé restée sans valeur arrête la preuve (un attendu mal rempli ne doit rien laisser passer).
create or replace function pg_temp.remplir(p_modele text, p_jetons jsonb)
returns text language plpgsql as $f$
declare k text; v text; r text := p_modele;
begin
  if r is null then return null; end if;
  for k, v in select j.key, j.value from jsonb_each_text(p_jetons) j loop
    r := replace(r, '{' || k || '}', v);
  end loop;
  if r ~ '\{[A-Za-z][A-Za-z_0-9]*\}' then
    raise exception 'remplir : clé sans valeur « % » dans « % »', substring(r from '\{[A-Za-z][A-Za-z_0-9]*\}'), left(r, 120);
  end if;
  return r;
end $f$;

-- Verdict : lève TOUJOURS une exception, qui annule tout ce que la preuve a fait. « VERT n/0 » : les contrôles du
-- plan nommés un par un, les autres comptés par groupe. « ROUGE réussis/échecs » : les comptes par groupe, puis les
-- échecs (40 au plus : l'outil qui rend le message tronque les messages longs). Les lignes d'information suivent,
-- jamais comptées. Sans aucun contrôle joué, le verdict est ROUGE.
create or replace function pg_temp.verdict()
returns void language plpgsql as $f$
declare v_ok integer; v_ko integer; v_plan text; v_groupes text; v_echecs text; v_infos text; v_msg text;
begin
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_infos
    from preuve where etat = 'info';
  if v_ko = 0 and v_ok > 0 then
    select string_agg(format('%s. %s', num, libelle), E'\n' order by num) into v_plan from preuve where groupe = 'plan';
    v_msg := format(E'VERT %s/0 (tout est annulé)\ncontrôles du plan :\n%s\npar groupe (réussis/joués) : %s',
      v_ok, coalesce(v_plan, 'aucun'), v_groupes);
  else
    select string_agg(format('- %s. [%s] %s', num, groupe, libelle) || coalesce(' : ' || nullif(left(detail, 160), ''), ''),
                      E'\n' order by num)
      into v_echecs
      from (select * from preuve where etat = 'échec' order by num limit 40) e;
    v_msg := format(E'ROUGE %s/%s (tout est annulé)\npar groupe (réussis/joués) : %s\néchecs (%s premiers sur %s) :\n%s',
      v_ok, v_ko, coalesce(v_groupes, 'aucun contrôle joué'), least(v_ko, 40), v_ko, coalesce(v_echecs, '- aucun'));
  end if;
  if v_infos is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_infos;
  end if;
  raise exception using message = v_msg;
end $f$;
