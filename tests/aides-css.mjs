// Aides du test des jetons de couleur : lecture d'une feuille de style en règles, relevé des couleurs
// écrites en dur dans un texte. Pas de dépendance : le CSS de l'app est du CSS plat (media et keyframes
// seuls en imbrication).

const NOMS_DE_COULEURS = ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
  "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod " +
  "darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
  "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
  "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
  "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
  "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
  "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid " +
  "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
  "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
  "palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown " +
  "salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan " +
  "teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen currentcolor").split(" ");

const RE_HEX = /(?<![\w&#-])#[0-9a-fA-F]{3,8}(?![\w-])/g;
const RE_FONCTION = /(?<![\w-])(?:rgba?|hsla?)\([^)]*\)/gi;
const RE_NOM = new RegExp("(?<![\\w#$@.&-])(?:" + NOMS_DE_COULEURS.join("|") + ")(?![\\w-])", "gi");

// Retire les commentaires /* ... */ en gardant les retours à la ligne : les numéros de ligne restent justes.
export function sansCommentaires(texte) {
  return texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// Retire url(...) et les chaînes entre guillemets (une valeur CSS n'y porte jamais une couleur utile :
// chemin, police, texte généré), en gardant la longueur.
export function sansUrlNiChaines(valeur) {
  return valeur
    .replace(/url\([^)]*\)/gi, (m) => " ".repeat(m.length))
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => " ".repeat(m.length));
}

// Les couleurs écrites en dur dans un texte, dans l'ordre : hex de 3, 4, 6 ou 8 chiffres, rgb()/rgba()/
// hsl()/hsla(), et (sauf { noms: false }) les noms de couleur CSS. Le repli d'un var(--x, #6B7F4E) compte.
export function couleursLitterales(texte, { noms = true } = {}) {
  const trouvees = [];
  for (const m of texte.matchAll(RE_HEX)) {
    if ([4, 5, 7, 9].includes(m[0].length)) trouvees.push({ i: m.index, t: m[0] });
  }
  for (const m of texte.matchAll(RE_FONCTION)) trouvees.push({ i: m.index, t: m[0] });
  if (noms) for (const m of texte.matchAll(RE_NOM)) trouvees.push({ i: m.index, t: m[0] });
  return trouvees.sort((a, b) => a.i - b.i).map((c) => c.t);
}

// Les couleurs « neutres » : blanc, noir, transparent, currentColor, et blanc ou noir translucide.
// Elles ne portent aucune identité de marque et restent écrites en dur.
export function estNeutre(litteral) {
  const l = String(litteral).toLowerCase().replace(/\s+/g, "");
  if (["#fff", "#ffffff", "#000", "#000000", "white", "black", "transparent", "currentcolor"].includes(l)) return true;
  return /^rgba?\((?:255,255,255|0,0,0)(?:,[^,)]+)?\)$/.test(l);
}

// transparent et currentColor ne sont pas des couleurs à habiller : ils ne comptent pas comme « contient une couleur ».
export function contientCouleur(valeur) {
  return couleursLitterales(sansUrlNiChaines(valeur))
    .some((c) => !["transparent", "currentcolor"].includes(c.toLowerCase()));
}

// Lit une feuille en règles { selecteur, contexte, declarations: [{ propriete, valeur, ligne }] }.
// `contexte` : les at-rules englobantes (@media, @supports, @keyframes...), de la plus externe à la plus interne.
// @font-face et les autres at-rules à corps de déclarations sont des règles comme les autres.
export function lireRegles(texteCss) {
  const t = sansCommentaires(texteCss);
  const retours = [];
  for (let i = 0; i < t.length; i++) if (t[i] === "\n") retours.push(i);
  const ligneDe = (idx) => {
    let bas = 0, haut = retours.length;
    while (bas < haut) { const m = (bas + haut) >> 1; if (retours[m] < idx) bas = m + 1; else haut = m; }
    return bas + 1;
  };
  const sauteChaine = (j) => {
    const c = t[j];
    let k = j + 1;
    while (k < t.length && t[k] !== c) k += t[k] === "\\" ? 2 : 1;
    return k + 1;
  };
  const regles = [];
  const pile = [];
  let debut = 0;
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === '"' || c === "'") { i = sauteChaine(i); continue; }
    if (c === ";") { debut = i + 1; i++; continue; }
    if (c === "}") { pile.pop(); debut = i + 1; i++; continue; }
    if (c !== "{") { i++; continue; }
    const prelude = t.slice(debut, i).trim().replace(/\s+/g, " ");
    if (/^@(?:-\w+-)?(?:media|supports|layer|container|keyframes|document)\b/i.test(prelude)) {
      pile.push(prelude);
      debut = i + 1; i++; continue;
    }
    // Corps d'une règle : jusqu'à l'accolade fermante, en respectant chaînes et parenthèses.
    let j = i + 1, prof = 0, finDecl = j;
    const declarations = [];
    const ajoute = (a, b) => {
      const brut = t.slice(a, b);
      const k = brut.indexOf(":");
      if (k < 0 || !brut.trim()) return;
      const propriete = brut.slice(0, k).trim();
      const valeur = brut.slice(k + 1).trim();
      const decalage = brut.length - brut.trimStart().length;
      if (propriete) declarations.push({ propriete, valeur, ligne: ligneDe(a + decalage) });
    };
    while (j < t.length) {
      const d = t[j];
      if (d === '"' || d === "'") { j = sauteChaine(j); continue; }
      if (d === "(") prof++;
      else if (d === ")") prof = Math.max(0, prof - 1);
      else if (d === ";" && prof === 0) { ajoute(finDecl, j); finDecl = j + 1; }
      else if (d === "}" && prof === 0) { ajoute(finDecl, j); break; }
      j++;
    }
    regles.push({ selecteur: prelude, contexte: [...pile], declarations });
    i = j + 1;
    debut = i;
  }
  return regles;
}
