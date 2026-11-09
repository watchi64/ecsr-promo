// Règles pures de la page Notes : lecture d'une saisie, cibles de la saisie thème par thème, avancement, origine
// d'une note et états vides (lot C de l'audit du 09/11). Sans DOM ni base : testées par
// tests/notes-saisie-rules.test.mjs. La matrice (js/views/notes.js) et l'écran « Saisir »
// (js/views/notes-saisie.js) s'en servent tous les deux, pour qu'une même règle ne vive qu'à un endroit.

// Parse une saisie de note. Deux formats acceptés :
//   - "X/Y"  → convertit en (X/Y)*20, arrondi à 0.1, stocke note_max=20.
//   - "X"    → note sur 20 directe (validé 0..20).
// Retour : null si vide, { error } si invalide, sinon { note, note_max, converted, original? }. `error` est la raison du
// refus, en minuscule et sans point, pour finir une phrase : « Pas enregistrée : <raison>. » (écran « Saisir ») ou
// phraseNoteRefusee (messages de la matrice, de la fiche d'un stagiaire et de « Ajouter une note »).
export function parseNoteInput(raw) {
  // Virgule ou point décimal, avec ou sans espaces autour (« 14 , 5 ») : un seul séparateur, le point.
  const s = String(raw ?? "").trim().replace(/\s*[.,]\s*/g, ".");
  if (s === "") return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const x = Number(m[1]), y = Number(m[2]);
    if (!(y > 0)) return { error: "après la barre, il faut un nombre plus grand que 0" };
    const sur = String(y).replace(".", ",");
    if (x < 0 || x > y) return { error: `sur ${sur}, la note va de 0 à ${sur}` };
    const note = Math.round((x / y) * 20 * 10) / 10;
    return { note, note_max: 20, converted: true, original: `${m[1]}/${m[2]}` };
  }
  const n = Number(s);
  if (!isFinite(n)) return { error: "tape une note de 0 à 20, ou par exemple 7/10" };
  if (n < 0 || n > 20) return { error: "la note va de 0 à 20" };
  return { note: n, note_max: 20, converted: false };
}

// Le message d'une note refusée (saisie pas comprise ou écriture en échec), hors de l'écran « Saisir » : une phrase.
// `effacement` : c'était un effacement qui a échoué (« Note non effacée »).
export function phraseNoteRefusee(raison, effacement = false) {
  return `Note non ${effacement ? "effacée" : "enregistrée"} : ${raison}.`;
}

// La question posée avant d'effacer une note (fenêtre de l'app, js/confirmer.js) : qui, combien, et où (« au thème 22 »,
// « aux thèmes 46 et 47 », « pour GDE »). `qui` peut manquer (une note sans stagiaire connu) ; une évaluation sans note
// (« Ajouter une note » accepte une note vide) se dit « évaluation », sans valeur.
export function confirmationEffacement({ qui, note, cible }) {
  const sansNote = note?.note == null || note.note === "";
  let ou = "";
  if (cible?.type === "Thème" && cible.theme_numero != null) {
    const groupe = THEME_GROUPS.find((g) => g[0] === Number(cible.theme_numero));
    ou = groupe ? ` aux thèmes ${groupe.slice(0, -1).join(", ")} et ${groupe[groupe.length - 1]}` : ` au thème ${cible.theme_numero}`;
  } else if (cible?.type === "Compétence" && cible.competence_code) {
    const col = MATRIX_SPECIAL_COLS.find((c) => c.key === cible.competence_code);
    ou = ` pour ${col ? col.label : cible.competence_code}`;
  }
  const phrase = sansNote
    ? `${qui ? "Son" : "Cette"} évaluation${ou} disparaît.`
    : `${qui ? "Sa" : "Cette"} note de ${String(note.note).replace(".", ",")}/${note.note_max ?? 20}${ou} disparaît.`;
  return {
    titre: qui ? `Effacer la note de ${qui} ?` : "Effacer cette note ?",
    phrase,
    oui: "Effacer la note",
  };
}

// Colonnes "spéciales" du tableau matrice (en plus des 57 thèmes). `nom` : le libellé en toutes lettres, pour la
// saisie thème par thème et la légende de la matrice.
export const MATRIX_SPECIAL_COLS = [
  { key: "C1",   label: "C1",   nom: "Accueillir et sensibiliser à la sécurité routière",
    tooltip: "Compétence formateur C1 : Accueillir & sensibiliser SR" },
  { key: "C2",   label: "C2",   nom: "Concevoir et animer",
    tooltip: "Compétence formateur C2 : Concevoir & animer" },
  { key: "REMC", label: "REMC", nom: "Référentiel pour l'éducation à une mobilité citoyenne",
    tooltip: "REMC : Vision globale du référentiel mobilité citoyenne" },
  { key: "MGDE", label: "GDE",  nom: "Matrice GDE : objectifs de la formation du conducteur",
    tooltip: "Matrice GDE : Goals for Driver Education" },
];

// Thèmes évalués ENSEMBLE par un seul QCM : une seule note, mais les deux colonnes
// restent affichées en en-tête. La cellule de note est FUSIONNÉE (colspan) sur le groupe,
// et la note est portée par le PREMIER thème du groupe (donc comptée une seule fois
// dans les moyennes). Pour ajouter un groupe : [numéro1, numéro2, ...].
export const THEME_GROUPS = [[46, 47]];

function sansAccents(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Ce qu'on peut noter, dans l'ordre de l'écran : les 4 compétences, puis les thèmes par numéro (un groupe en une
// ligne, portée par son premier thème). `numero` et `libelle` servent à l'affichage et à la recherche.
export function ciblesDeSaisie(themes) {
  const parNum = new Map((themes || []).filter((t) => t && t.numero != null).map((t) => [Number(t.numero), t]));
  const suiveurs = new Set(THEME_GROUPS.flatMap((g) => g.slice(1)));
  const cibles = MATRIX_SPECIAL_COLS.map((c) => ({
    cle: c.key, type: "Compétence", competence_code: c.key, numero: c.label, libelle: c.nom,
  }));
  [...parNum.keys()].sort((a, b) => a - b).forEach((n) => {
    if (suiveurs.has(n)) return;
    const groupe = THEME_GROUPS.find((g) => g[0] === n);
    const titre = parNum.get(n).titre || `Thème ${n}`;
    const libelle = groupe
      ? groupe.map((k) => parNum.get(k)?.titre || `Thème ${k}`).join(" et ")
      : titre;
    cibles.push({
      cle: "T" + n, type: "Thème", theme_numero: n, theme_titre: parNum.get(n).titre ?? null,
      numero: groupe ? groupe.join(" + ") : String(n), libelle,
    });
  });
  return cibles;
}

export function filtrerCibles(cibles, recherche) {
  const q = sansAccents(recherche);
  if (!q) return cibles.slice();
  return cibles.filter((c) => sansAccents(c.numero).includes(q) || sansAccents(c.libelle).includes(q));
}

// Les seuls champs d'une cible qui partent en base (jamais cle, numero ni libelle). L'objet de la matrice
// ({ type, theme_numero, theme_titre } ou { type, competence_code }) passe tel quel.
export function champsDeCible(cible) {
  if (cible.type === "Compétence") return { type: "Compétence", competence_code: cible.competence_code };
  return { type: "Thème", theme_numero: cible.theme_numero, theme_titre: cible.theme_titre ?? null };
}

function correspond(e, stagiaireId, cible) {
  if (e.stagiaire_id !== stagiaireId || e.type !== cible.type) return false;
  return cible.type === "Compétence"
    ? e.competence_code === cible.competence_code
    : e.theme_numero === cible.theme_numero;
}

// La note affichée pour un stagiaire et une cible : la plus récente par date d'évaluation (règle de la matrice).
export function derniereNote(evaluations, stagiaireId, cible) {
  const matches = (evaluations || [])
    .filter((e) => correspond(e, stagiaireId, cible))
    .sort((a, b) => new Date(b.date_eval) - new Date(a.date_eval));
  return matches[0] || null;
}

export function avancement(evaluations, stagiaireIds, cible) {
  const n = stagiaireIds.filter((id) => derniereNote(evaluations, id, cible)).length;
  return { n, total: stagiaireIds.length };
}

export function libelleAvancement({ n, total }) {
  return n === 0 ? "aucune" : `${n} sur ${total}`;
}

// « 12 oct. » pour une date AAAA-MM-JJ, lue en date locale (pas de décalage de fuseau).
function jourCourt(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function origineNote(evaluation) {
  const examen = evaluation.qcm_attempt_id != null || evaluation.observation === "QCM examen";
  return (examen ? "Examen QCM du " : "Saisie le ") + jourCourt(evaluation.date_eval);
}

const ETATS_VIDES = {
  "equipe-matrice": { titre: "Aucune note pour l'instant",
    phrase: "Les notes arrivent ici toutes seules quand un stagiaire passe un examen QCM. Tu peux aussi les saisir toi-même.",
    actions: ["examen", "saisir"] },
  "equipe-saisir": { titre: "Aucune note pour l'instant",
    phrase: "Les notes arrivent ici toutes seules quand un stagiaire passe un examen QCM. Tu peux aussi les saisir toi-même.",
    actions: ["examen"] },
  "classe-stagiaire": { titre: "Pas encore de notes",
    phrase: "Les notes de la classe apparaîtront après le premier examen.",
    actions: ["entrainement"] },
  "classe-formateur": { titre: "Pas encore de notes",
    phrase: "Les notes de la classe apparaîtront après le premier examen.",
    actions: ["examen"] },
  "direction": { titre: "Aucune note pour l'instant",
    phrase: "Les notes arrivent ici avec les examens QCM.",
    actions: [] },
};

// L'état vide d'une page de notes : une phrase et les actions qui en sortent, ou null dès qu'une note existe.
export function etatVideNotes({ nbNotes, contexte }) {
  if (nbNotes > 0) return null;
  const e = ETATS_VIDES[contexte];
  return e ? { titre: e.titre, phrase: e.phrase, actions: e.actions.slice() } : null;
}

// La raison d'un échec d'écriture d'une note, en français, pour « Pas enregistrée : <raison>. » : jamais le message brut
// du réseau ou de la base (« Failed to fetch », « JWT expired »). Seule la connexion perdue se réessaie telle quelle.
const RAISON_CONNEXION = "la connexion a échoué";
export function raisonEchecNote(erreur) {
  const texte = String(erreur?.message ?? erreur ?? "");
  const code = String(erreur?.code ?? "");
  if (/jwt|not authenticated/i.test(texte) || /^PGRST30[0-3]$/.test(code)) return "ta session a expiré, reconnecte-toi";
  if (code === "42501" || /row-level security|permission denied/i.test(texte)) return "tu n'as pas le droit de modifier cette note";
  return RAISON_CONNEXION;
}

// Ce que dit la ligne d'un stagiaire de l'écran « Saisir » après un enregistrement (r : le résultat d'enregistrerNote ;
// avant : la note en place avant l'envoi ; enErreur : la ligne disait une erreur). { texte, erreur, reessayer }, ou null
// quand la ligne ne change pas. Une note refusée se dit en une phrase (« Pas effacée » quand c'était un effacement,
// r.effacement) ; « Réessayer » n'est offert que si la connexion a
// lâché (une session expirée ou un droit refusé échoueraient de nouveau). Remettre la note déjà en base efface l'erreur :
// la ligne redit d'où vient la note.
export function etatDeLigne(r, avant, enErreur = false) {
  const net = (texte) => ({ texte, erreur: false, reessayer: false });
  const origine = () => net(avant ? origineNote(avant) : "");
  switch (r?.etat) {
    case "enregistree":
      return net(r.converti ? `${r.converti} converti en ${String(r.note).replace(".", ",")}/20` : "Enregistrée");
    case "effacee": return net("Note effacée");
    case "gardee": return origine();
    case "inchangee": return enErreur ? origine() : null;
    case "invalide": return { texte: `Pas enregistrée : ${r.message}.`, erreur: true, reessayer: false };
    case "erreur":
      return { texte: `${r.effacement ? "Pas effacée" : "Pas enregistrée"} : ${r.message}.`, erreur: true,
        reessayer: r.message === RAISON_CONNEXION };
    default: return null;
  }
}

// Quelle carte vide montrer : `classe` (La classe de Mon suivi, sinon la page Notes), `admin` (écrit des notes),
// `personnel` (formateur, direction, siège). Le personnel qui n'écrit pas (la direction) lit sans action : ni
// « Saisir », ni l'entraînement d'un stagiaire.
export function contexteEtatVide({ classe, admin, personnel }) {
  if (admin) return classe ? "classe-formateur" : "equipe-matrice";
  return personnel ? "direction" : "classe-stagiaire";
}
