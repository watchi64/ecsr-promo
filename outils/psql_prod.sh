#!/usr/bin/env bash
# Lance psql sur la production avec l'adresse du .env, sans jamais l'afficher. Usage : psql_prod.sh [arguments psql]
# L'adresse (clé SUPABASE_DB_URL) est lue dans le .env de la racine du projet ECSR (ECSR_ENV pour un autre chemin) ;
# elle n'est ni écrite, ni affichée : toute adresse que psql afficherait est masquée. Jamais lancé sans l'accord de Timy.
ENV_FILE="${ECSR_ENV:-/c/Users/watch/Dev/ECSR/.env}"
URL=$(grep -m1 '^SUPABASE_DB_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/')
eval "$(URL="$URL" node -e '
const u=process.env.URL;const m=u.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:\/]+):(\d+)\/(.+)$/);if(!m){console.log("echo forme_non_reconnue >&2; exit 2");process.exit(0);}
let [_,user,pw,host,port,db]=m;if(pw.startsWith("[")&&pw.endsWith("]"))pw=pw.slice(1,-1);
const q=s=>"\x27"+s.replace(/\x27/g,"\x27\\x27\x27")+"\x27";
console.log("export PGUSER="+q(user)+" PGPASSWORD="+q(pw)+" PGHOST="+q(host)+" PGPORT="+q(port)+" PGDATABASE="+q(db)+" PGCONNECT_TIMEOUT=15");')"
PSQL="$(command -v psql || echo /c/Users/watch/scoop/apps/postgresql/current/bin/psql)"
# pipefail : le code de sortie du script est celui de psql (le tube vers sed ne le cache pas).
set -o pipefail
"$PSQL" -X -v ON_ERROR_STOP=1 "$@" 2>&1 | sed -E 's#postgres(ql)?://[^ ]*#<adresse masquée>#g'
