/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Lecteur de cours. Le contenu vit en base (table cours, colonne corps_md,
 * cf. js/db.js) et se rend ici en DOM, sans innerHTML, comme le reste de
 * l'app.
 *
 * Le markdown de nos cours suit une charte stricte (voir CLAUDE.md du dépôt
 * formation-ecsr), ce qui permet de traiter trois blocs de façon particulière :
 *   - la citation d'ouverture « L'essentiel en 6 lignes » devient une carte ;
 *   - les lignes `_Textes : R411-25_` deviennent une mention de source discrète
 *     et non du corps de texte en italique ;
 *   - un tableau qui porte une colonne « Amende » devient un tableau de
 *     sanctions (montants et points en chiffres tabulaires).
 */
import { el, clear } from "../utils.js?v=20260808b";
import { icon } from "../icons.js?v=20260808b";
import { carteSignal, signalConnu } from "../signaux.js?v=20260808b";
import { carteMarquage, marquageConnu } from "../marquage.js?v=20260808b";
import { listCoursIndex, getCours } from "../db.js?v=20260808b";
import { isAdmin, isProf } from "../auth-admin.js?v=20260808b";

// Index des cours visibles, chargé une fois par rendu de la page Thèmes.
let coursIndex = null;  // Map numero -> { id, titre, published, updated_by, updated_at }

/** Charge (ou recharge) l'index des cours visibles. À appeler avant hasCours(). */
export async function chargerCoursIndex() {
  const lignes = await listCoursIndex();
  coursIndex = new Map(lignes.map((c) => [Number(c.numero), c]));
  return coursIndex;
}

/** Le thème a-t-il un cours visible ? (index chargé par chargerCoursIndex) */
export function hasCours(theme) {
  return !!theme && !!coursIndex && coursIndex.has(Number(theme.numero));
}

// ===== Rendu markdown =====

// Inline : liens, gras, italique, code. Renvoie un fragment (jamais d'innerHTML).
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_/;

function inline(texte) {
  const frag = document.createDocumentFragment();
  let reste = String(texte);
  let m;
  while ((m = INLINE.exec(reste))) {
    if (m.index > 0) frag.appendChild(document.createTextNode(reste.slice(0, m.index)));
    if (m[1] !== undefined) {
      frag.appendChild(el("a", { href: m[2], target: "_blank", rel: "noopener noreferrer" }, m[1]));
    } else if (m[3] !== undefined) {
      frag.appendChild(el("strong", {}, m[3]));
    } else if (m[4] !== undefined) {
      frag.appendChild(el("code", {}, m[4]));
    } else {
      frag.appendChild(el("em", {}, m[5] !== undefined ? m[5] : m[6]));
    }
    reste = reste.slice(m.index + m[0].length);
  }
  if (reste) frag.appendChild(document.createTextNode(reste));
  return frag;
}

function estSeparateurTableau(ligne) {
  return /^\|[\s:|-]+\|$/.test(ligne.trim());
}

function cellules(ligne) {
  return ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

// Un tableau de sanctions se reconnaît à sa colonne « Amende » : ses nombres
// méritent la police tabulaire et la colonne des points un accent.
function classeTableau(entetes) {
  const joint = entetes.join(" ").toLowerCase();
  if (joint.includes("amende")) return "cours-table cours-table-sanctions";
  return "cours-table";
}

// Un tableau de sanctions ne tient pas en colonnes sur un téléphone : l'infraction
// est une phrase, les trois autres cellules de courtes valeurs. On le rend donc en
// fiches, l'infraction en tête et les valeurs en pastilles. Rien n'est perdu : ce
// qui suit le nombre de points (suspension, immobilisation) passe en note.
function indexEntetes(entetes) {
  const trouve = (motif) => entetes.findIndex((e) => motif.test(e.toLowerCase()));
  return {
    infraction: trouve(/infraction/),
    article: trouve(/article/),
    amende: trouve(/amende/),
    points: trouve(/retrait|point/),
    source: trouve(/source/),
  };
}

function pastille(classe, contenu) {
  return el("span", { class: "sanction-chip " + classe }, contenu);
}

function rendreSanctions(lignes, entetes) {
  const idx = indexEntetes(entetes);
  const liste = el("div", { class: "sanctions-liste" });

  for (const ligne of lignes.slice(2)) {
    const c = cellules(ligne);
    const fiche = el("article", { class: "sanction" });
    fiche.appendChild(el("p", { class: "sanction-infraction" }, inline(c[idx.infraction] || "")));

    const meta = el("div", { class: "sanction-meta" });
    if (idx.article >= 0 && c[idx.article]) {
      meta.appendChild(pastille("chip-article", inline(c[idx.article])));
    }
    if (idx.amende >= 0 && c[idx.amende]) {
      meta.appendChild(pastille("chip-amende", inline(c[idx.amende])));
    }

    // « **3 points** (de plein droit) : + suspension… » : la valeur va en
    // pastille, la précision en note sous la fiche.
    let note = "";
    if (idx.points >= 0 && c[idx.points]) {
      const brut = c[idx.points];
      const m = brut.match(/^\s*\*{0,2}\s*(\d+\s*points?|aucun|0)\s*\*{0,2}\s*(.*)$/i);
      if (m) {
        const valeur = m[1].trim();
        const zero = /^(0|aucun)$/i.test(valeur);
        meta.appendChild(pastille("chip-points" + (zero ? " chip-zero" : ""),
          zero ? "0 point" : valeur));
        // « (de plein droit) : + suspension… » se lit mieux en phrase.
        note = m[2].replace(/^[\s:,.\-]+/, "")
          .replace(/^\(de plein droit\)\s*[:,]?\s*\+?\s*/i, "De plein droit. ")
          .replace(/^\+\s*/, "")
          .trim();
        // Majuscule en tête de chaque phrase de la note.
        note = note.replace(/(^|\.\s+)([a-zà-ÿ])/g, (t, avant, lettre) => avant + lettre.toUpperCase());
      } else {
        note = brut;
      }
    }
    if (idx.source >= 0 && c[idx.source]) {
      const lien = c[idx.source].match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lien) {
        meta.appendChild(el("a", {
          class: "sanction-chip chip-source", href: lien[2],
          target: "_blank", rel: "noopener noreferrer",
        }, lien[1]));
      } else {
        meta.appendChild(pastille("chip-source", inline(c[idx.source])));
      }
    }
    fiche.appendChild(meta);
    if (note) fiche.appendChild(el("p", { class: "sanction-note" }, inline(note)));
    liste.appendChild(fiche);
  }
  return liste;
}

function rendreTableau(lignes) {
  const entetes = cellules(lignes[0]);
  const idx = indexEntetes(entetes);
  // Le format des tableaux de sanctions est imposé par la charte : si les
  // colonnes attendues sont là, on passe en fiches. Sinon, tableau classique.
  if (idx.infraction >= 0 && idx.amende >= 0) return rendreSanctions(lignes, entetes);

  const table = el("table", { class: classeTableau(entetes) });
  const thead = el("thead", {}, el("tr", {}, entetes.map((c) => el("th", {}, inline(c)))));
  const corps = el("tbody");
  for (const ligne of lignes.slice(2)) {
    corps.appendChild(el("tr", {}, cellules(ligne).map((c) => el("td", {}, inline(c)))));
  }
  table.appendChild(thead);
  table.appendChild(corps);
  // Enveloppe défilante : un tableau large ne doit jamais pousser la page.
  return el("div", { class: "cours-table-wrap" }, table);
}

// Planche de schémas. Le markdown écrit `:::signaux AB6 AB7`, une légende
// facultative, puis `:::`. Un code inconnu du registre est ignoré : mieux vaut
// une planche incomplète qu'un panneau inventé.
function rendreSignaux(codes, legende) {
  const cartes = codes.filter(signalConnu).map(carteSignal);
  if (!cartes.length) return null;
  const bloc = el("figure", { class: "signaux-bloc" },
    el("div", { class: "signaux-grille" }, cartes),
  );
  if (legende) bloc.appendChild(el("figcaption", { class: "signaux-legende" }, inline(legende)));
  return bloc;
}

// Planche de marquage au sol : les modulations dessinées à l'échelle.
function rendreMarquage(codes, legende) {
  const cartes = codes.filter(marquageConnu).map(carteMarquage);
  if (!cartes.length) return null;
  const bloc = el("figure", { class: "marquage-bloc" },
    el("div", { class: "marquage-grille" }, cartes),
  );
  if (legende) bloc.appendChild(el("figcaption", { class: "signaux-legende" }, inline(legende)));
  return bloc;
}

// Bloc de citation. Deux cas : la fiche synthèse d'ouverture, et les notes du
// paragraphe sanctions (qui peuvent contenir un tableau).
function rendreCitation(lignes, contexte) {
  const contenu = lignes.map((l) => l.replace(/^>\s?/, ""));
  const titre = contenu[0] || "";

  if (!contexte.essentielVu && /L'essentiel/i.test(titre)) {
    contexte.essentielVu = true;
    const points = contenu.slice(1).filter((l) => l.trim());
    return el("aside", { class: "cours-essentiel" },
      el("p", { class: "cours-essentiel-titre" }, "L'essentiel"),
      el("ul", {}, points.map((p) => el("li", {}, inline(p)))),
    );
  }

  return el("aside", { class: "cours-note" }, rendreBlocs(contenu, contexte));
}

// Découpe un texte markdown en blocs et les rend. Utilisé pour le document
// entier comme pour l'intérieur d'une citation.
function rendreBlocs(lignes, contexte) {
  const sortie = [];
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i];
    const nu = ligne.trim();

    if (!nu) { i++; continue; }

    // Titre de niveau 1 : porté par l'en-tête du lecteur, pas répété ici.
    if (/^#\s/.test(nu)) { i++; continue; }

    if (/^##\s/.test(nu)) {
      const texte = nu.replace(/^##\s*/, "");
      const id = "cours-sec-" + (contexte.sections.length + 1);
      contexte.sections.push({ id, texte });
      sortie.push(el("h2", { class: "cours-h2", id }, inline(texte)));
      i++; continue;
    }
    if (/^###\s/.test(nu)) {
      sortie.push(el("h3", { class: "cours-h3" }, inline(nu.replace(/^###\s*/, ""))));
      i++; continue;
    }
    if (/^####\s/.test(nu)) {
      sortie.push(el("h4", { class: "cours-h4" }, inline(nu.replace(/^####\s*/, ""))));
      i++; continue;
    }

    if (/^---+$/.test(nu)) { i++; continue; }

    // Planches illustrées : panneaux ou marquage au sol.
    const planche = nu.match(/^:::(signaux|marquage)\s*(.*)$/);
    if (planche) {
      const codes = planche[2].split(/\s+/).filter(Boolean);
      i++;
      const legende = [];
      while (i < lignes.length && lignes[i].trim() !== ":::") { legende.push(lignes[i].trim()); i++; }
      i++;  // referme le bloc
      const texte = legende.filter(Boolean).join(" ");
      const bloc = planche[1] === "signaux" ? rendreSignaux(codes, texte) : rendreMarquage(codes, texte);
      if (bloc) sortie.push(bloc);
      continue;
    }

    if (nu.startsWith(">")) {
      const bloc = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) bloc.push(lignes[i].trim()), i++;
      sortie.push(rendreCitation(bloc, contexte));
      continue;
    }

    // Tableau : en-tête puis ligne de séparation.
    if (nu.startsWith("|") && i + 1 < lignes.length && estSeparateurTableau(lignes[i + 1])) {
      const bloc = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) bloc.push(lignes[i].trim()), i++;
      sortie.push(rendreTableau(bloc));
      continue;
    }

    // Liste à puces.
    if (/^[-*]\s/.test(nu)) {
      const items = [];
      while (i < lignes.length && /^[-*]\s/.test(lignes[i].trim())) {
        items.push(lignes[i].trim().replace(/^[-*]\s*/, ""));
        i++;
      }
      sortie.push(el("ul", { class: "cours-ul" }, items.map((t) => el("li", {}, inline(t)))));
      continue;
    }

    // Liste numérotée.
    if (/^\d+\.\s/.test(nu)) {
      const items = [];
      while (i < lignes.length && /^\d+\.\s/.test(lignes[i].trim())) {
        items.push(lignes[i].trim().replace(/^\d+\.\s*/, ""));
        i++;
      }
      sortie.push(el("ol", { class: "cours-ol" }, items.map((t) => el("li", {}, inline(t)))));
      continue;
    }

    // Mention de source en fin de sous-partie. Elle reste disponible mais ne
    // s'impose pas au regard : une pastille discrète, qui se déplie au survol
    // sur ordinateur et au clic partout ailleurs.
    const source = nu.match(/^_(Textes|Sources)\s*:\s*(.+?)_$/);
    if (source) {
      const val = el("span", { class: "cours-source-val" }, source[2]);
      const btn = el("button", {
        class: "cours-source-btn", type: "button",
        "aria-expanded": "false",
        title: "Voir la référence",
      }, source[1]);
      const bloc = el("p", { class: "cours-source" }, btn, val);
      btn.addEventListener("click", () => {
        const ouvert = bloc.classList.toggle("open");
        btn.setAttribute("aria-expanded", ouvert ? "true" : "false");
      });
      sortie.push(bloc);
      i++; continue;
    }

    // Paragraphe : lignes consécutives jusqu'à une ligne vide.
    const para = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#|>|\||[-*]\s|\d+\.\s|---)/.test(lignes[i].trim())) {
      para.push(lignes[i].trim());
      i++;
    }
    if (para.length) sortie.push(el("p", { class: "cours-p" }, inline(para.join(" "))));
    else i++;
  }

  return sortie;
}

/** Titre du cours (première ligne `# `), sans le préfixe « THÈME XX - ». */
function extraireTitre(texte) {
  const m = texte.match(/^#\s+(.+)$/m);
  if (!m) return null;
  return m[1].replace(/^TH[ÈE]ME\s+\d+\s*[-:]\s*/i, "").trim();
}

function tempsLecture(texte) {
  const mots = texte.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

// ===== Écran de lecture =====

/** Rend un texte markdown complet. Renvoie { noeuds, contexte } ;
 *  contexte.sections liste les titres de niveau 2 (pour le sommaire). */
export function rendreMarkdown(texte) {
  const contexte = { sections: [], essentielVu: false };
  return { noeuds: rendreBlocs(String(texte).split("\n"), contexte), contexte };
}

/**
 * Ouvre le cours d'un thème en plein écran, par-dessus la vue courante.
 * Fermeture par la croix ou Échap seulement : un clic à côté ne doit pas
 * faire perdre sa position de lecture.
 */
export async function openCoursSheet(theme) {
  const numero = Number(theme.numero);
  const overlay = el("div", { class: "cours-overlay" });
  const barre = el("div", { class: "cours-progress" });
  const jauge = el("div", { class: "cours-progress-bar" });
  barre.appendChild(jauge);

  const meta = el("p", { class: "cours-head-meta" }, "Chargement…");
  const fermer = el("button", { class: "cours-close", type: "button", "aria-label": "Fermer le cours" });
  fermer.appendChild(icon.close ? icon.close() : document.createTextNode("×"));

  const tete = el("div", { class: "cours-head" },
    el("div", { class: "cours-head-main" },
      el("span", { class: "cours-num" }, String(numero).padStart(2, "0")),
      el("div", {},
        el("h2", { class: "cours-head-titre" }, theme.titre),
        meta,
      ),
    ),
    fermer,
  );

  const sommaire = el("nav", { class: "cours-sommaire" });
  const corps = el("div", { class: "cours-body" });
  const article = el("article", { class: "cours-article" }, corps);
  const defilement = el("div", { class: "cours-scroll" }, sommaire, article);

  overlay.appendChild(barre);
  overlay.appendChild(tete);
  overlay.appendChild(defilement);
  document.body.appendChild(overlay);
  document.body.classList.add("cours-open");

  function close() {
    overlay.remove();
    document.body.classList.remove("cours-open");
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  fermer.addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  // Progression de lecture : repère utile sur un cours long.
  defilement.addEventListener("scroll", () => {
    const total = defilement.scrollHeight - defilement.clientHeight;
    const ratio = total > 0 ? Math.min(1, defilement.scrollTop / total) : 0;
    jauge.style.width = (ratio * 100).toFixed(1) + "%";
  });

  try {
    const cours = await getCours(numero);
    const texte = cours.corps_md;

    const { noeuds, contexte } = rendreMarkdown(texte);

    clear(corps);
    noeuds.forEach((n) => corps.appendChild(n));

    const titre = extraireTitre(texte);
    if (titre) tete.querySelector(".cours-head-titre").textContent = titre;
    meta.textContent = `${contexte.sections.length} sections · ${tempsLecture(texte)} min de lecture`;

    // État formateur/admin : le stagiaire n'a pas à voir la cuisine.
    if (isAdmin() || isProf()) {
      const quand = cours.updated_at
        ? new Date(cours.updated_at).toLocaleDateString("fr-FR") : "";
      meta.textContent += (cours.published ? " · Publié" : " · Non publié")
        + (cours.updated_by ? ` · modifié par ${cours.updated_by} le ${quand}` : "");
    }

    // Sommaire : les titres de niveau 2, numérotés comme dans le cours.
    clear(sommaire);
    contexte.sections.forEach((s) => {
      const court = s.texte.replace(/^\d+\.\s*/, "");
      const lien = el("button", { class: "cours-somm-item", type: "button" },
        el("span", { class: "cours-somm-num" }, (s.texte.match(/^(\d+)\./) || [, "•"])[1]),
        court,
      );
      lien.addEventListener("click", () => {
        const cible = document.getElementById(s.id);
        if (cible) defilement.scrollTo({ top: cible.offsetTop - 8, behavior: "smooth" });
      });
      sommaire.appendChild(lien);
    });
  } catch (e) {
    console.error("Cours introuvable:", e);
    clear(corps);
    corps.appendChild(el("p", { class: "cours-p" }, "Le cours n'a pas pu être chargé."));
    corps.appendChild(el("p", { class: "muted", style: "font-size:0.82rem" }, "Détail : " + (e?.message || e)));
    meta.textContent = "Erreur de chargement";
  }
}
