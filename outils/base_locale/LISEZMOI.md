# Base locale jetable

Une base PostgreSQL locale, sans aucun lien avec la production, pour répéter une migration et jouer une preuve SQL
(`tests/sql/*.sql`) avant d'y toucher. Elle se reconstruit en une dizaine de secondes.

## Ce qu'elle contient

- `clones/clone_1_fonctions.sql`, `clone_2_anonymisation.sql`, `clone_3_tables.sql` : le schéma de la production relevé le
  28/10/2026 (rôles `anon`, `authenticated`, `service_role`, schémas `auth` et `storage`, tables, fonctions). Aucune donnée.
- `clones/clone_4_donnees.sql` : des données **fictives** aux volumes de la production (3 lieux, 3 promos, 17 comptes
  `@local.test`), sans nom ni adresse réels.
- Le lot 4 (rôles et portées) : les clones décrivent la base d'avant lui. Le script joue les retours 2 et 3 du lot 4 (qui
  posent les anciennes fonctions et règles), les données fictives, puis les migrations 1, 2 et 3 du lot 4, comme la
  production les a reçues le 29/10. Toute migration plus récente du dépôt se joue ensuite à la main (ou par la preuve,
  qui l'injecte).

## Reconstruire

```
bash outils/base_locale/reconstruire.sh [--port 55435] [--donnees <dossier>]
bash outils/base_locale/reconstruire.sh --arreter [--port ...] [--donnees ...]
```

- Port par défaut : 55435. Dossier par défaut : `.base-locale/` à la racine du dépôt (supprimé puis refait à chaque
  reconstruction ; ne jamais le versionner). Les binaires PostgreSQL (`initdb`, `pg_ctl`, `psql`) doivent être dans le
  `PATH` (scoop : `scoop install postgresql`).
- Connexion : `psql -h 127.0.0.1 -p 55435 -U postgres -d postgres`. Pas de mot de passe (`trust`, écoute locale).

## Jouer une preuve

```
node outils/assembler_repetition_roles.mjs <mode> <sortie.sql>      # sortie hors du dépôt
PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p 55435 -U postgres -d postgres -X -q -f <sortie.sql>
```

Le verdict est le message de l'erreur finale (`VERT n/0` ou `ROUGE ...`) : la preuve lève toujours une exception, tout ce
qu'elle fait est annulé. Modes : voir l'en-tête de `outils/assembler_repetition_roles.mjs`. Pour une preuve « en ligne »
(après application), appliquer d'abord la migration à la main :
`psql ... -1 -f supabase/migrations/<migration>.sql`.

## Production

`outils/psql_prod.sh` ouvre `psql` sur la production sans jamais afficher l'adresse de connexion (lue dans le `.env` de la
racine du projet, clé `SUPABASE_DB_URL`). Il n'est jamais lancé sans l'accord explicite de Timy, et jamais par un agent.
Aucune adresse, aucun mot de passe n'est versionné.
