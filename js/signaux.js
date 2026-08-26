/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Registre des panneaux illustrant les cours.
 *
 * Les dessins sont les fichiers OFFICIELS de la signalisation française,
 * installés dans assets/signaux/ depuis la bibliothèque du dépôt
 * (ressources/Panneaux_signalisation_svg). On n'en copie que ce que les cours
 * référencent : la liste grandit thème par thème.
 *
 * Deux règles tiennent ce fichier :
 *   - un code absent du registre n'est pas dessiné, jamais deviné ;
 *   - l'intitulé d'un panneau est celui qu'en donne notre cours contrôlé, pas
 *     une reformulation libre. Un panneau dont nos cours ne fixent pas encore
 *     le sens (AB2, par exemple) n'entre pas ici, même si son fichier existe.
 *
 * Les quatre entrées `famille-*` ne sont pas des panneaux mais la grille de
 * lecture forme + couleur : elles restent dessinées ici, volontairement nues.
 *
 * Le CATALOGUE (js/signaux-catalogue.js, 384 codes) complète ce registre pour
 * la galerie de l'éditeur et le lecteur : un code absent d'ici mais présent
 * au catalogue se dessine quand même (photo Wikimedia, sans détail
 * pédagogique), le registre vérifié gardant la priorité en cas de doublon.
 */
import { CATALOGUE } from "./signaux-catalogue.js?v=20260826c";

const NS = "http://www.w3.org/2000/svg";
const ROUGE = "#C8102E";
const BLEU = "#0057A6";
const BLANC = "#FFFFFF";
const NOIR = "#1A1A1A";

// Le jeton `?v=` du module sert aussi aux images : un déploiement invalide leur
// cache en même temps que le code.
function jetonVersionSignaux() {
  const q = String(import.meta.url).split("?")[1];
  return q ? "?" + q : "";
}

function cheminSignal(fichier) {
  return new URL("assets/signaux/" + fichier + ".svg" + jetonVersionSignaux(), document.baseURI).href;
}

// Le fichier du catalogue porte déjà son extension (ex. "AB1.svg").
function cheminCatalogue(fichier) {
  return new URL("assets/signaux/catalogue/" + fichier + jetonVersionSignaux(), document.baseURI).href;
}

function svgSignal(contenu) {
  const node = document.createElementNS(NS, "svg");
  node.setAttribute("xmlns", NS);
  node.setAttribute("viewBox", "0 0 100 100");
  node.setAttribute("role", "img");
  node.classList.add("signal-svg");
  node.innerHTML = contenu;
  return node;
}

export const SIGNAUX = {
  // --- Grille de lecture : la forme et la couleur avant le pictogramme ---
  "famille-danger": {
    nom: "Danger", detail: "Triangle à bordure rouge",
    dessin: () => svgSignal(`<polygon points="50,8 94,86 6,86" fill="${BLANC}"
      stroke="${ROUGE}" stroke-width="9" stroke-linejoin="round"/>`),
  },
  // La prescription est une seule catégorie, qui prend deux formes : le disque
  // à bordure rouge interdit, le disque bleu oblige. Les montrer ensemble évite
  // de laisser croire à deux catégories distinctes.
  "famille-prescription": {
    nom: "Prescription", detail: "Disque à bordure rouge (interdiction) ou disque bleu (obligation)",
    dessin: () => svgSignal(`
      <circle cx="32" cy="50" r="27" fill="${BLANC}" stroke="${ROUGE}" stroke-width="8"/>
      <circle cx="70" cy="50" r="27" fill="${BLEU}"/>`),
  },
  "famille-indication": {
    nom: "Indication", detail: "Carré bleu",
    dessin: () => svgSignal(`
      <rect x="9" y="9" width="82" height="82" rx="6" fill="${BLEU}"/>
      <rect x="16" y="16" width="68" height="68" rx="3" fill="none" stroke="${BLANC}" stroke-width="3"/>`),
  },
  // La direction se reconnaît à sa forme allongée et à sa pointe de flèche ; sa
  // couleur, elle, dépend du réseau suivi (voir le cours).
  "famille-direction": {
    nom: "Direction", detail: "Rectangle terminé en pointe, couleur selon le réseau",
    dessin: () => svgSignal(`
      <polygon points="6,30 74,30 94,50 74,70 6,70" fill="${BLANC}" stroke="${NOIR}" stroke-width="4"
               stroke-linejoin="round"/>
      <rect x="18" y="46" width="34" height="7" fill="${NOIR}"/>`),
  },

  // --- Priorité et intersections ---
  // Le champ `serie` reprend la taxonomie du CATALOGUE (galerie de l'éditeur) :
  // un code vérifié appartient à la même série que son équivalent catalogué.
  AB1: { fichier: "AB1", nom: "Priorité à droite", serie: "priorites",
    detail: "Intersection où la priorité à droite s'applique" },
  AB3a: { fichier: "AB3a", nom: "Cédez le passage", serie: "priorites",
    detail: "Céder le passage à l'intersection" },
  AB4: { fichier: "AB4", nom: "Stop", serie: "priorites",
    detail: "Arrêt absolu à la limite de la chaussée abordée" },
  AB5: { fichier: "AB5", nom: "Signal avancé du stop", serie: "priorites",
    detail: "Complété d'un panonceau de distance" },
  AB6: { fichier: "AB6", nom: "Route prioritaire", serie: "priorites",
    detail: "Rappelé tout au long de l'itinéraire" },
  AB7: { fichier: "AB7", nom: "Fin de route prioritaire", serie: "priorites",
    detail: "Le losange barré" },
  AB25: { fichier: "AB25", nom: "Carrefour à sens giratoire", serie: "priorites",
    detail: "Annonce le giratoire" },

  // --- Prescriptions ---
  B1: { fichier: "B1", nom: "Sens interdit", serie: "prescription",
    detail: "Accès interdit à tout véhicule" },
  B14: { fichier: "B14_50", nom: "Limitation de vitesse", serie: "prescription",
    detail: "Ici 50 km/h" },
  B31: { fichier: "B31", nom: "Fin de toutes les interdictions", serie: "prescription",
    detail: "Lève les interdictions précédemment signalées" },
  B33: { fichier: "B33_50", nom: "Fin de limitation de vitesse", serie: "prescription",
    detail: "Lève la seule limitation indiquée" },
  B34: { fichier: "B34", nom: "Fin d'interdiction de dépasser", serie: "prescription",
    detail: "Lève la seule interdiction de dépasser" },

  // --- Agglomération ---
  EB10: { fichier: "EB10", nom: "Entrée d'agglomération", serie: "agglomeration",
    detail: "Déclenche les règles urbaines, dont le 50 km/h" },
  EB20: { fichier: "EB20", nom: "Sortie d'agglomération", serie: "agglomeration",
    detail: "Lève les règles urbaines" },

  // --- Balises ---
  J1: { fichier: "J1", nom: "Balise de virage", serie: "balisage",
    detail: "Jalonne l'extérieur d'une courbe" },
  J3: { fichier: "J3", nom: "Balise d'intersection", serie: "balisage",
    detail: "Signale une intersection, sans rien dire de la priorité" },
  J5: { fichier: "J5", nom: "Balise de musoir", serie: "balisage",
    detail: "Tête d'îlot, point de divergence des chaussées" },
  J11: { fichier: "J11", nom: "Balise cylindrique", serie: "balisage",
    detail: "Matérialise îlots, séparateurs et obstacles ponctuels" },

  // --- Signalisation temporaire ---
  AK5: { fichier: "AK5", nom: "Travaux", serie: "temporaire",
    detail: "Danger temporaire, fond jaune" },

  // --- Panonceaux ---
  M1: { fichier: "M1a", nom: "Panonceau de distance", serie: "panonceaux",
    detail: "Le panneau s'applique à la distance indiquée" },
};

/** Le code correspond-il à un schéma disponible (registre vérifié ou catalogue) ? */
export function signalConnu(code) {
  return Object.prototype.hasOwnProperty.call(SIGNAUX, code)
    || Object.prototype.hasOwnProperty.call(CATALOGUE, code);
}

function visuel(code, s) {
  if (s.dessin) {
    const d = s.dessin();
    d.setAttribute("aria-label", s.nom);
    return d;
  }
  const img = document.createElement("img");
  img.className = "signal-svg";
  img.src = cheminSignal(s.fichier);
  img.alt = code + " : " + s.nom;
  img.loading = "lazy";
  return img;
}

function visuelCatalogue(code, c) {
  const img = document.createElement("img");
  img.className = "signal-svg";
  img.src = cheminCatalogue(c.fichier);
  img.alt = code + " : " + c.nom;
  img.loading = "lazy";
  return img;
}

function construireCarte(code, nom, detail, noeudVisuel) {
  const fig = document.createElement("figure");
  fig.className = "signal-card";
  const vis = document.createElement("div");
  vis.className = "signal-vis";
  vis.appendChild(noeudVisuel);
  const cap = document.createElement("figcaption");
  cap.className = "signal-cap";
  if (!code.startsWith("famille-")) {
    const c = document.createElement("span");
    c.className = "signal-code";
    c.textContent = code;
    cap.appendChild(c);
  }
  const n = document.createElement("span");
  n.className = "signal-nom";
  n.textContent = nom;
  cap.appendChild(n);
  if (detail) {
    const d = document.createElement("span");
    d.className = "signal-detail";
    d.textContent = detail;
    cap.appendChild(d);
  }
  fig.appendChild(vis);
  fig.appendChild(cap);
  return fig;
}

/**
 * Carte d'un signal : le dessin, son code et son intitulé. Le registre
 * vérifié (SIGNAUX) garde la priorité ; à défaut, le catalogue complet fournit
 * l'image et le nom, sans détail pédagogique (non contrôlé thème par thème).
 */
export function carteSignal(code) {
  const s = SIGNAUX[code];
  if (s) return construireCarte(code, s.nom, s.detail, visuel(code, s));
  const c = CATALOGUE[code];
  if (!c) return null;
  return construireCarte(code, c.nom, null, visuelCatalogue(code, c));
}
