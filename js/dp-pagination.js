// Composition du Dossier Professionnel en feuilles A4.
//
// Le gabarit (js/views/dp-gabarit.js) produit un FLUX de blocs, sans se
// préoccuper des pages. Ce module les mesure dans le DOM et les répartit sur des
// feuilles, comme Word repagine un document dont le texte déborde.
//
// Mesurer impose que les feuilles soient RENDUES : un conteneur en display:none
// n'a ni hauteur ni rectangle. L'appelant fournit un hôte hors écran mais rendu.

export const PX_PAR_MM = 96 / 25.4;

// En dessous de cette hauteur restante, on n'ouvre pas une zone de rédaction en
// bas de feuille : deux ou trois lignes orphelines se lisent mal.
export const HAUTEUR_MIN_MORCEAU = 10 * PX_PAR_MM;

// Répartit les blocs sur des feuilles. Renvoie le nombre de feuilles produites,
// le numéro de feuille où commence chaque bloc, et celui où commence chaque
// rubrique (clé data-cle), dont le sommaire a besoin.
export function composer(blocs, { hote, fabriquerFeuille }) {
  hote.textContent = "";
  const numeroParBloc = [];
  const numeroParCle = new Map();
  let numero = 0;
  let corps = null;
  let hUtile = 0;

  function nouvelleFeuille(estCouverture) {
    numero += 1;
    const f = fabriquerFeuille(numero, estCouverture);
    hote.appendChild(f);
    corps = f.querySelector(".dp-corps");
    hUtile = corps.clientHeight;
  }

  // Tolérance d'un pixel : les arrondis de rendu font varier scrollHeight.
  const deborde = () => corps.scrollHeight > hUtile + 1;

  blocs.forEach((bloc, index) => {
    const estCouverture = bloc.dataset.cle === "couverture";
    if (!corps || (bloc.dataset.ouvrant === "1" && corps.childElementCount)) {
      nouvelleFeuille(estCouverture);
    }
    numeroParBloc[index] = numero;
    if (bloc.dataset.cle && !numeroParCle.has(bloc.dataset.cle)) {
      numeroParCle.set(bloc.dataset.cle, numero);
    }

    let aPlacer = bloc.cloneNode(true);
    while (aPlacer) {
      corps.appendChild(aPlacer);

      if (!deborde()) {
        // Un intitulé de question ne reste jamais seul en bas de feuille : sa
        // zone de réponse doit pouvoir commencer en dessous.
        if (aPlacer.dataset.avecSuivant === "1" && corps.childElementCount > 1
            && hUtile - corps.scrollHeight < HAUTEUR_MIN_MORCEAU) {
          corps.removeChild(aPlacer);
          nouvelleFeuille(false);
          numeroParBloc[index] = numero;
          if (bloc.dataset.cle) numeroParCle.set(bloc.dataset.cle, numero);
          corps.appendChild(aPlacer);
        }
        aPlacer = null;
        break;
      }

      if (aPlacer.dataset.nature === "secable") {
        const reste = couper(aPlacer, corps, hUtile);
        if (reste !== null) {
          // Le morceau posé et sa suite ne sont plus des champs : seul le flux
          // d'édition porte les data-k, jamais le document composé.
          aPlacer.removeAttribute("data-k");
          const suite = aPlacer.cloneNode(false);
          suite.classList.add("dp-suite");
          suite.removeAttribute("data-k");
          suite.textContent = reste;
          nouvelleFeuille(false);
          aPlacer = suite;
          continue;
        }
      }

      // Bloc insécable, ou coupe impossible faute de place pour une seule ligne.
      corps.removeChild(aPlacer);
      if (corps.childElementCount === 0) {
        // Le bloc dépasse à lui seul la hauteur d'une feuille. On le garde et on
        // laisse déborder : perdre du texte serait pire qu'une feuille trop pleine.
        corps.classList.add("dp-corps-deborde");
        corps.appendChild(aPlacer);
        aPlacer = null;
        break;
      }
      nouvelleFeuille(false);
      numeroParBloc[index] = numero;
      if (bloc.dataset.cle) numeroParCle.set(bloc.dataset.cle, numero);
    }
  });

  return { feuilles: numero, numeroParBloc, numeroParCle };
}

// Coupe le texte d'un bloc à la dernière ligne visuelle qui tient dans la place
// restante, et renvoie le texte restant. Renvoie null si tout tient, ou si même
// un mot ne tient pas.
//
// La recherche est dichotomique sur l'offset caractère : on cherche le plus
// grand offset dont le bas du dernier rectangle de ligne reste au-dessus de la
// limite. getClientRects donne un rectangle par ligne visuelle, ce qui évite de
// mesurer caractère par caractère.
function couper(el, corps, hUtile) {
  const noeud = el.firstChild;
  if (!noeud || noeud.nodeType !== Node.TEXT_NODE || !noeud.data) return null;
  const texte = noeud.data;

  const cs = getComputedStyle(el);
  const bas = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  const limite = corps.getBoundingClientRect().top + hUtile - bas;

  const r = document.createRange();
  let lo = 0;
  let hi = texte.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    r.setStart(noeud, 0);
    r.setEnd(noeud, mid);
    const rects = r.getClientRects();
    if (!rects.length) { lo = mid + 1; continue; }
    if (rects[rects.length - 1].bottom <= limite) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (best >= texte.length) return null;

  // On recule au dernier séparateur avant la coupe quand il en existe un ; à
  // défaut (un mot à lui seul plus long qu'une ligne), on coupe au plus juste,
  // en plein mot : refuser de couper ferait déborder indéfiniment la feuille,
  // alors qu'un navigateur fait la même chose avec une césure forcée.
  const espace = texte.lastIndexOf(" ", best);
  const ligne = texte.lastIndexOf("\n", best);
  const sep = Math.max(espace, ligne);
  const coupe = sep > 0 ? sep + 1 : best;
  if (coupe <= 0) return null;

  const reste = texte.slice(coupe);
  noeud.data = texte.slice(0, coupe);
  return reste.length ? reste : null;
}

// Mode édition : au lieu de couper, on montre où tomberont les coupures. Le
// candidat garde un flux continu, éditable d'un seul tenant, tout en voyant le
// découpage du document qu'il imprimera.
//
// Le trait n'est pas numéroté : le ruban d'édition contient aussi les fiches
// encore vides, qui ne seront pas imprimées, donc sa numérotation ne serait pas
// celle du document remis au jury. Les vrais numéros vivent au sommaire.
export function marquerCoupures(flux, numeroParBloc) {
  flux.querySelectorAll(".dp-coupure").forEach((n) => n.remove());
  const blocs = [...flux.children].filter((n) => n.classList.contains("dp-bloc"));
  blocs.forEach((bloc, i) => {
    if (i === 0) return;
    const numero = numeroParBloc[i];
    if (numero === undefined || numero === numeroParBloc[i - 1]) return;
    const trait = document.createElement("div");
    trait.className = "dp-coupure";
    trait.textContent = "Saut de feuille";
    flux.insertBefore(trait, bloc);
  });
}
