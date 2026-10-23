// Questions proposees par l'IA : construction de la demande et controle des brouillons.
// Module pur (teste en node par tests/qcm-ia-brouillons.test.mjs) : l'Edge Function ne
// fait que l'appeler. Regle d'or : tout numero d'article cite par un brouillon qui ne
// figure pas dans le texte du cours source fait ecarter le brouillon.

// Plus large que le verrou de l'assistant (MOTIF_ARTICLE de chatbot/verrou-articles.mjs) :
// la lettre est facultative, pour attraper « article 221-6 du Code penal ». Un nombre
// a tiret absent du cours (« 25-34 ans ») est aussi ecarte : ce n'est pas dans la source.
// Le (?!\d) final evite les plages d'annees (2024-2025). Copie conforme dans
// js/qcm-ia-rules.js, un test verifie que les deux donnent le meme resultat.
const MOTIF_ARTICLE = /\b(?:[RLD]\.?\s?)?\d{2,4}(?:-\d{1,3})+(?!\d)/gi;

const NB_REPONSES = 5;
const MAX_EXISTANTS = 80;

function normaliserNumero(num) {
  return String(num ?? "").toUpperCase().replace(/[.\s]/g, "");
}

/** Numeros d'article cites dans un texte, normalises (R. 413-4 -> R413-4), sans doublon. */
export function articlesCites(texte) {
  const vus = new Set();
  for (const m of String(texte ?? "").matchAll(MOTIF_ARTICLE)) vus.add(normaliserNumero(m[0]));
  return [...vus];
}

/** Titres de niveau 2 et 3 du cours, dans l'ordre (le titre 1 est celui du theme). */
export function titresDuCours(md) {
  const titres = [];
  for (const ligne of String(md ?? "").split("\n")) {
    const m = /^(#{2,3}) (.+)$/.exec(ligne.trimEnd());
    if (m) titres.push({ niveau: m[1].length, titre: m[2].trim() });
  }
  return titres;
}

/** Texte d'une partie du cours (titre compris) jusqu'au titre suivant de meme niveau ou
 *  plus haut. Titre vide ou inconnu : le cours entier. */
export function extrairePartie(md, titre) {
  const texte = String(md ?? "");
  if (!titre) return texte;
  const lignes = texte.split("\n");
  let debut = -1;
  let niveau = 0;
  for (let i = 0; i < lignes.length; i++) {
    const m = /^(#{2,3}) (.+)$/.exec(lignes[i].trimEnd());
    if (!m) continue;
    if (debut < 0) {
      if (m[2].trim() === titre) { debut = i; niveau = m[1].length; }
    } else if (m[1].length <= niveau) {
      return lignes.slice(debut, i).join("\n").trim();
    }
  }
  return debut < 0 ? texte : lignes.slice(debut).join("\n").trim();
}

const SYSTEME = [
  "Tu rédiges des brouillons de questions de QCM pour des stagiaires qui préparent le titre professionnel d'enseignant de la conduite et de la sécurité routière (ECSR). Un formateur relira chaque brouillon avant de l'accepter.",
  "",
  "Règles absolues :",
  "1. Ta seule source est le cours fourni entre les balises COURS. N'ajoute aucun fait, aucune valeur, aucune exception qui n'y figure pas. Chaque bonne réponse doit se justifier par une phrase du cours.",
  "2. Ne cite jamais de numéro d'article de loi (R413-3, L234-1, article 221-6...) sauf s'il est écrit tel quel dans le cours. En cas de doute, n'en cite aucun et renvoie à la partie du cours.",
  `3. Chaque question a exactement ${NB_REPONSES} réponses : une seule bonne en général, plusieurs seulement si le cours énumère plusieurs éléments justes. Les mauvaises réponses sont plausibles (valeurs voisines, confusion entre deux règles du cours), jamais absurdes ni humoristiques. Pas de « toutes les réponses » ni d'« aucune réponse ».`,
  "4. L'énoncé est une question claire et autonome, sans « selon le cours ». Il teste un fait utile : une valeur, une condition, une exception, une distinction entre deux règles.",
  "5. L'explication tient en deux phrases au plus : la bonne réponse et la règle, sans moraliser.",
  "6. Style : français soigné, phrases déclaratives, « le conducteur », « l'élève », pas de tutoiement. N'utilise jamais le tiret long (tiret cadratin) : deux-points, virgule ou parenthèses à la place.",
  "7. Ne reprends aucune question déjà présente dans le QCM (liste fournie), même reformulée.",
  "",
  "Le cours peut contenir des blocs :::signaux ou :::marquage suivis de codes (AB6, T1...) : ce sont des panneaux ou des marquages, utilisables comme le reste du texte.",
  "",
  "Réponds uniquement par un objet JSON de cette forme :",
  '{"questions":[{"section":"...","enonce":"...","options":[{"texte":"...","correcte":true},{"texte":"...","correcte":false}],"explication":"...","partie_cours":"..."}]}',
  "« section » est un intitulé court, de préférence une section déjà utilisée dans le QCM. « partie_cours » recopie exactement un des titres du cours listés.",
].join("\n");

/** Messages envoyes au modele : le cours (ou la partie visee) et les enonces deja
 *  presents. Aucune donnee de stagiaire n'entre ici. */
export function construireMessages({ titreTheme, coursMd, partie, nombre, existants, sections }) {
  const source = extrairePartie(coursMd, partie)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "");  // images : du bruit pour le modele
  const n = Math.max(1, Math.min(5, Number(nombre) || 3));
  const deja = (existants || []).slice(0, MAX_EXISTANTS)
    .map((e) => "- " + String(e).replace(/\s+/g, " ").slice(0, 200));
  const titres = titresDuCours(coursMd).map((t) => "- " + t.titre);
  const user = [
    `Thème : ${titreTheme}`,
    `Partie visée : ${partie ? `« ${partie} »` : "tout le cours"}`,
    `Rédige ${n} question${n > 1 ? "s" : ""} différente${n > 1 ? "s" : ""}.`,
    "",
    "Sections déjà utilisées dans ce QCM :",
    (sections || []).length ? sections.map((s) => "- " + s).join("\n") : "- (aucune)",
    "",
    "Questions déjà présentes (à ne pas reproduire) :",
    deja.length ? deja.join("\n") : "- (aucune)",
    "",
    "Titres du cours (pour partie_cours, à recopier exactement) :",
    titres.join("\n"),
    "",
    "=== COURS ===",
    source,
    "=== FIN DU COURS ===",
  ].join("\n");
  return [{ role: "system", content: SYSTEME }, { role: "user", content: user }];
}

// Jamais de tiret cadratin dans la base : le modele en produit parfois malgre la consigne.
function propre(v, max) {
  return String(v ?? "")
    .replace(/\s*\u2014\s*/g, " : ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[:,;\s]+/, "")
    .slice(0, max);
}

function cleEnonce(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function controleStructure(b) {
  if (!b.enonce) return "énoncé vide";
  if (b.options.length < 3) return "moins de 3 réponses";
  if (b.options.length > 6) return "plus de 6 réponses";
  if (b.options.some((o) => !o.texte)) return "réponse vide";
  const textes = new Set(b.options.map((o) => o.texte.toLowerCase()));
  if (textes.size < b.options.length) return "deux réponses identiques";
  if (!b.options.some((o) => o.is_correct)) return "aucune bonne réponse";
  if (b.options.every((o) => o.is_correct)) return "aucune mauvaise réponse";
  return null;
}

/** Lit la reponse du modele et trie les brouillons : acceptables d'un cote, ecartes
 *  (avec leur motif) de l'autre. Leve une erreur si la reponse est illisible.
 *  @param {string} brut
 *  @param {{ articlesCours: string[], titres: string[], existants?: string[], nombre?: number }} contexte */
export function analyserReponse(brut, { articlesCours, titres, existants = [], nombre = 5 }) {
  let obj;
  try {
    obj = JSON.parse(String(brut ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new Error("Réponse de l'IA illisible");
  }
  if (!obj || !Array.isArray(obj.questions)) throw new Error("Réponse de l'IA illisible");

  const autorises = new Set((articlesCours || []).map(normaliserNumero));
  const titresConnus = new Set(titres || []);
  const vus = new Set((existants || []).map(cleEnonce));
  const brouillons = [];
  const ecartes = [];

  for (const q of obj.questions) {
    const partie = titresConnus.has(String(q?.partie_cours ?? "").trim()) ? String(q.partie_cours).trim() : null;
    let explication = propre(q?.explication, 1200);
    if (partie) explication = (explication ? explication + " " : "") + `Voir le cours : « ${partie} ».`;
    const b = {
      section: propre(q?.section, 80) || null,
      enonce: propre(q?.enonce, 600),
      options: (Array.isArray(q?.options) ? q.options : []).map((o) => ({
        texte: propre(o?.texte, 300),
        is_correct: o?.correcte === true || o?.is_correct === true,
      })),
      explication: explication || null,
      partie_cours: partie,
    };

    let motif = controleStructure(b);
    if (!motif && vus.has(cleEnonce(b.enonce))) motif = "doublon d'une question existante";
    if (!motif) {
      const tout = [b.section, b.enonce, b.explication, ...b.options.map((o) => o.texte)].join("\n");
      const absents = articlesCites(tout).filter((a) => !autorises.has(a));
      if (absents.length) motif = `cite ${absents.join(", ")}, absent du cours`;
    }
    if (!motif && brouillons.length >= nombre) continue;

    if (motif) ecartes.push({ ...b, motif });
    else { brouillons.push(b); vus.add(cleEnonce(b.enonce)); }
  }
  return { brouillons, ecartes };
}
