// Titres (étape 3) : chaque fonction de js/db.js appelle la RPC des titres avec exactement les noms de paramètres SQL (p_...)
// des migrations 6, 7 et 8. Un nom de trop, en moins ou mal écrit ferait répondre PostgREST « fonction introuvable » (PGRST202).
// Lancer : node --test tests/titres-rpc-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const MIGRATIONS = [
  "supabase/migrations/20261112_titres_6_gestion.sql",
  "supabase/migrations/20261115_titres_7_correctifs.sql",
  "supabase/migrations/20261115_titres_8_apercu.sql",
];

// Les paramètres SQL de chaque fonction publique créée ou remplacée dans ces migrations ; la dernière définition l'emporte.
function parametresSql() {
  const params = new Map();
  for (const chemin of MIGRATIONS) {
    const texte = lire(chemin);
    for (const m of texte.matchAll(/create (?:or replace )?function public\.([a-z_]+)\(([^)]*)\)/g)) {
      const noms = m[2].split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+/)[0]);
      params.set(m[1], noms);
    }
  }
  return params;
}

// Les appels supabase.rpc("nom", { cle: ... }) de js/db.js : nom -> liste des listes de clés (un appel sans objet : []).
function appelsDb() {
  const db = lire("js/db.js");
  const appels = new Map();
  for (const m of db.matchAll(/supabase\.rpc\("([a-z_]+)"(?:,\s*\{([^}]*)\})?\)/g)) {
    const cles = m[2] == null ? [] : [...m[2].matchAll(/(p_[a-z_]+)\s*:/g)].map((x) => x[1]);
    if (!appels.has(m[1])) appels.set(m[1], []);
    appels.get(m[1]).push(cles);
  }
  return appels;
}

const RPC_DES_TITRES = {
  mes_titres: "lireMesTitres",
  titres_visibles: "lireTitresVisibles",
  titres_ajustables: "lireTitresAjustables",
  personnes_et_titres: "lirePersonnesEtTitres",
  journal_des_droits: "lireJournalDesDroits",
  journal_present: "lireJournalPresent",
  donner_titre: "donnerTitre",
  creer_titre: "creerTitre",
  ajuster_titre: "ajusterTitre",
  supprimer_titre: "supprimerTitre",
  titres_ouverts: "lireTitresOuverts",
  regler_titres_ouverts: "reglerTitresOuverts",
  retirer_titre: "retirerTitre",
};

test("chaque RPC des titres appelée par js/db.js porte exactement les paramètres SQL", () => {
  const sql = parametresSql();
  // retirer_titre vient de la migration 5 (signature inchangée depuis).
  const cinq = /create function public\.retirer_titre\(([^)]*)\)/.exec(lire("supabase/migrations/20261112_titres_5_fermetures.sql"));
  sql.set("retirer_titre", cinq[1].split(",").map((x) => x.trim().split(/\s+/)[0]));
  const appels = appelsDb();
  const db = lire("js/db.js");
  for (const [rpc, fonction] of Object.entries(RPC_DES_TITRES)) {
    assert.ok(sql.has(rpc), `${rpc} : définie dans les migrations`);
    assert.ok(new RegExp(`export async function ${fonction}\\(`).test(db), `${fonction} exportée par js/db.js`);
    const liste = appels.get(rpc) || [];
    assert.equal(liste.length, 1, `${rpc} : un seul appel dans js/db.js`);
    assert.deepEqual([...liste[0]].sort(), [...sql.get(rpc)].sort(), `${rpc} : paramètres de ${fonction}`);
  }
});

test("le test lit bien les signatures (contrôle du lecteur)", () => {
  const sql = parametresSql();
  assert.deepEqual(sql.get("donner_titre"), ["p_email", "p_titre_id", "p_lieu_id", "p_promo_ids", "p_prof_id"]);
  assert.deepEqual(sql.get("ajuster_titre"), ["p_titre_id", "p_lieu_id", "p_nom", "p_cases"]);
  assert.deepEqual(sql.get("mes_titres"), []);
  assert.deepEqual(sql.get("titres_ajustables"), ["p_lieu_id"]);
});
