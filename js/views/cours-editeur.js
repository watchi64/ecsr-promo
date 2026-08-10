/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Éditeur de cours (formateurs et admin). Markdown brut à gauche, aperçu à
 * droite, rendu par le même moteur que le lecteur : l'aperçu est exactement ce
 * que verra le stagiaire. Sur téléphone, une bascule Éditer/Aperçu.
 *
 * Garde-fou optimiste : le updated_at lu à l'ouverture accompagne chaque
 * enregistrement ; si le cours a bougé entre-temps, un bandeau propose
 * d'écraser ou d'abandonner, rien ne part sans décision.
 */
import { el, clear, debounce } from "../utils.js?v=20260810h";
import { icon } from "../icons.js?v=20260810h";
import { getCours, saveCours, setCoursPublie, listCoursVersions, getCoursVersion, uploadCoursImage }
  from "../db.js?v=20260810h";
import { rendreMarkdown } from "./cours-reader.js?v=20260810h";
import { insererSyntaxe, titreDepuisMarkdown, cheminImage } from "../cours-rules.js?v=20260810h";
import { getProfileWho } from "../auth-admin.js?v=20260810h";
import { reduireImage } from "../cours-images.js?v=20260810h";
import { SIGNAUX, carteSignal } from "../signaux.js?v=20260810h";
import { CATALOGUE } from "../signaux-catalogue.js?v=20260810h";
import { MARQUAGES, carteMarquage } from "../marquage.js?v=20260810h";

const OUTILS = [
  { label: "Gras", avant: "**", apres: "**", defaut: "texte" },
  { label: "Titre", avant: "\n### ", apres: "\n", defaut: "Sous-partie" },
  { label: "Tableau", avant: "\n| Situation | Règle |\n|---|---|\n| ", apres: " |  |\n", defaut: "cas" },
];

// ===== Galerie de panneaux : fusion du registre vérifié (SIGNAUX, qui garde
// la priorité en cas de code partagé) et du catalogue complet (384 codes),
// calculée une fois au chargement du module. =====
const LIBELLES_SERIE = {
  danger: "Danger",
  priorites: "Priorités",
  prescription: "Prescription (B)",
  indication: "Indication",
  services: "Services",
  agglomeration: "Agglomération",
  localisation: "Localisation",
  "passage-niveau": "Passages à niveau",
  temporaire: "Temporaire",
  balisage: "Balisage",
  panonceaux: "Panonceaux",
};
const ORDRE_SERIE = Object.keys(LIBELLES_SERIE);

const FAMILLES_SIGNAUX = Object.keys(SIGNAUX)
  .filter((code) => code.startsWith("famille-"))
  .map((code) => ({ code, nom: SIGNAUX[code].nom }));

const SIGNAUX_CATALOGUE = (() => {
  const items = [];
  for (const [code, s] of Object.entries(SIGNAUX)) {
    if (code.startsWith("famille-")) continue;
    items.push({ code, nom: s.nom, serie: s.serie || null });
  }
  for (const [code, c] of Object.entries(CATALOGUE)) {
    if (Object.prototype.hasOwnProperty.call(SIGNAUX, code)) continue; // doublon : le registre vérifié gagne
    items.push({ code, nom: c.nom, serie: c.serie });
  }
  return items;
})();

const COMPTES_SERIE = SIGNAUX_CATALOGUE.reduce((acc, it) => {
  if (it.serie) acc[it.serie] = (acc[it.serie] || 0) + 1;
  return acc;
}, {});

function normaliserRecherche(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function openCoursEditeur(numero, { onFerme } = {}) {
  const cours = await getCours(numero);
  let ouvertA = cours.updated_at;   // jeton du garde-fou optimiste
  let sauve = true;                 // l'éditeur est-il aligné avec la base ?
  let aChange = false;              // au moins un enregistrement réussi ?

  const overlay = el("div", { class: "cours-overlay cours-editeur" });

  const statut = el("span", { class: "editeur-statut" },
    cours.published ? "Publié" : "Non publié");
  const btnPublier = el("button", { class: "btn", type: "button" },
    cours.published ? "Dépublier" : "Publier");
  const fermer = el("button", { class: "cours-close", type: "button",
    "aria-label": "Fermer l'éditeur" });
  fermer.appendChild(icon.close ? icon.close() : document.createTextNode("×"));

  const tete = el("div", { class: "cours-head" },
    el("div", { class: "cours-head-main" },
      el("span", { class: "cours-num" }, String(numero).padStart(2, "0")),
      el("div", {},
        el("h2", { class: "cours-head-titre" }, cours.titre),
        el("p", { class: "cours-head-meta" }, "Modification du cours"),
      ),
    ),
    el("div", { class: "editeur-actions" }, statut, btnPublier, fermer),
  );

  // Bandeau de message (erreurs, conflits) : rien ne passe par alert/confirm.
  const bandeau = el("div", { class: "editeur-bandeau", hidden: true });

  const zone = el("textarea", { class: "editeur-zone", spellcheck: "true" });
  zone.value = cours.corps_md;
  const apercu = el("div", { class: "cours-article editeur-apercu" });

  // Insère avant/sélection/après au point d'insertion en passant par la pile
  // d'annulation native du navigateur : Ctrl+Z défait l'insertion. Écrire
  // zone.value directement viderait cette pile ; c'est le repli seulement.
  function insererSyntaxeZone(avant, apres, defaut) {
    zone.focus();
    const debut = zone.selectionStart, fin = zone.selectionEnd;
    const sel = zone.value.slice(debut, fin) || defaut;
    if (!document.execCommand("insertText", false, avant + sel + apres)) {
      const r = insererSyntaxe(zone.value, debut, fin, avant, apres, defaut);
      zone.value = r.texte;
    }
    zone.setSelectionRange(debut + avant.length, debut + avant.length + sel.length);
    marquerNonSauve();
    rafraichirApercu();
  }

  const outils = el("div", { class: "editeur-outils" });
  for (const o of OUTILS) {
    const b = el("button", { class: "btn", type: "button" }, o.label);
    b.addEventListener("click", () => insererSyntaxeZone(o.avant, o.apres, o.defaut));
    outils.appendChild(b);
  }

  // ===== Galerie de planches : choisir un panneau ou un marquage en le voyant,
  // au lieu de connaître son code par cœur. Un clic insère une planche neuve ;
  // si le curseur est déjà sur la ligne de codes d'une planche du même type,
  // le code s'ajoute au bout (les clics successifs composent une planche). =====
  const galerie = el("div", { class: "editeur-galerie", hidden: true });
  let galerieType = null;

  function insererCodePlanche(type, code) {
    zone.focus();
    const pos = zone.selectionStart;
    const debutLigne = zone.value.lastIndexOf("\n", pos - 1) + 1;
    const finBrute = zone.value.indexOf("\n", pos);
    const finLigne = finBrute === -1 ? zone.value.length : finBrute;
    if (zone.value.slice(debutLigne, finLigne).startsWith(":::" + type + " ")) {
      zone.setSelectionRange(finLigne, finLigne);
      if (!document.execCommand("insertText", false, " " + code)) {
        zone.value = zone.value.slice(0, finLigne) + " " + code + zone.value.slice(finLigne);
      }
      zone.setSelectionRange(finLigne + 1 + code.length, finLigne + 1 + code.length);
    } else {
      const tete = `\n:::${type} ${code}`;
      if (!document.execCommand("insertText", false, `${tete}\nLégende.\n:::\n`)) {
        zone.value = zone.value.slice(0, pos) + `${tete}\nLégende.\n:::\n` + zone.value.slice(pos);
      }
      // Curseur en fin de ligne de codes : le clic suivant complète la planche.
      zone.setSelectionRange(pos + tete.length, pos + tete.length);
    }
    marquerNonSauve();
    rafraichirApercu();
  }

  // ===== Filtres et recherche de la galerie « Panneaux » (384 codes du
  // catalogue + 20 vérifiés + 4 familles). Le type « marquage » n'a que 6
  // vignettes : il n'a pas besoin de filtre et garde son ancien rendu direct. =====
  let filtreSerie = "tous";
  let filtreTexte = "";
  const grilleSignaux = el("div", { class: "editeur-galerie-grille" });
  const barreFiltres = el("div", { class: "editeur-galerie-filtres" });
  const champRecherche = el("input", { type: "search", class: "editeur-recherche",
    placeholder: "Rechercher un code ou un nom…" });
  champRecherche.addEventListener("input", debounce(() => {
    filtreTexte = champRecherche.value;
    rafraichirGrilleSignaux();
  }, 150));

  function itemsGalerieSignaux() {
    let liste;
    if (filtreSerie === "familles") liste = FAMILLES_SIGNAUX;
    else if (filtreSerie === "tous") liste = [...FAMILLES_SIGNAUX, ...SIGNAUX_CATALOGUE];
    else liste = SIGNAUX_CATALOGUE.filter((it) => it.serie === filtreSerie);
    const q = normaliserRecherche(filtreTexte.trim());
    if (!q) return liste;
    return liste.filter((it) => normaliserRecherche(it.code).includes(q) || normaliserRecherche(it.nom).includes(q));
  }

  function rafraichirGrilleSignaux() {
    clear(grilleSignaux);
    for (const it of itemsGalerieSignaux()) {
      const v = el("button", { class: "editeur-vignette", type: "button",
        title: it.code.startsWith("famille-") ? it.code : `Insérer ${it.code}`,
        onClick: () => insererCodePlanche("signaux", it.code) });
      v.appendChild(carteSignal(it.code));
      grilleSignaux.appendChild(v);
    }
  }

  function rafraichirBarreFiltres() {
    clear(barreFiltres);
    const puce = (valeur, libelle) => el("button", {
      class: "editeur-puce" + (filtreSerie === valeur ? " on" : ""), type: "button",
      onClick: () => { filtreSerie = valeur; rafraichirBarreFiltres(); rafraichirGrilleSignaux(); },
    }, libelle);
    barreFiltres.appendChild(puce("tous", `Tous (${FAMILLES_SIGNAUX.length + SIGNAUX_CATALOGUE.length})`));
    for (const s of ORDRE_SERIE) {
      if (!COMPTES_SERIE[s]) continue;
      barreFiltres.appendChild(puce(s, `${LIBELLES_SERIE[s]} (${COMPTES_SERIE[s]})`));
    }
    barreFiltres.appendChild(puce("familles", `Familles (${FAMILLES_SIGNAUX.length})`));
  }

  function togglerGalerie(type) {
    if (!galerie.hidden && galerieType === type) { galerie.hidden = true; return; }
    galerieType = type;
    clear(galerie);
    if (type === "signaux") {
      filtreSerie = "tous";
      filtreTexte = "";
      champRecherche.value = "";
      rafraichirBarreFiltres();
      galerie.appendChild(barreFiltres);
      galerie.appendChild(champRecherche);
      galerie.appendChild(grilleSignaux);
      rafraichirGrilleSignaux();
    } else {
      const grilleMarquage = el("div", { class: "editeur-galerie-grille" });
      for (const code of Object.keys(MARQUAGES)) {
        const v = el("button", { class: "editeur-vignette", type: "button",
          title: `Insérer ${code}`, onClick: () => insererCodePlanche("marquage", code) });
        v.appendChild(carteMarquage(code));
        grilleMarquage.appendChild(v);
      }
      galerie.appendChild(grilleMarquage);
    }
    versionsPanneau.hidden = true;
    galerie.hidden = false;
  }

  const btnPanneaux = el("button", { class: "btn", type: "button",
    onClick: () => togglerGalerie("signaux") }, "Panneaux");
  const btnMarquage = el("button", { class: "btn", type: "button",
    onClick: () => togglerGalerie("marquage") }, "Marquage");
  outils.appendChild(btnPanneaux);
  outils.appendChild(btnMarquage);
  const champFichier = el("input", { type: "file", accept: "image/*", hidden: true });
  const btnImage = el("button", { class: "btn", type: "button" }, "Image");
  btnImage.addEventListener("click", () => champFichier.click());
  champFichier.addEventListener("change", async () => {
    const fichier = champFichier.files[0];
    champFichier.value = "";
    if (!fichier) return;
    btnImage.disabled = true;
    btnImage.textContent = "Envoi…";
    try {
      const blob = await reduireImage(fichier);
      const url = await uploadCoursImage(blob, cheminImage(numero, fichier.name, Date.now()));
      insererSyntaxeZone("\n![", `](${url})\n`, "légende");
    } catch (e) {
      message("Échec du téléversement : " + (e?.message || e));
    } finally {
      btnImage.disabled = false;
      btnImage.textContent = "Image";
    }
  });

  const btnVersions = el("button", { class: "btn", type: "button" }, "Versions");
  const btnEnregistrer = el("button", { class: "btn primary", type: "button" }, "Enregistrer");
  outils.appendChild(btnVersions);
  outils.appendChild(btnEnregistrer);
  outils.insertBefore(btnImage, btnVersions);
  outils.appendChild(champFichier);

  // Bascule mobile : sur grand écran le CSS montre les deux panneaux.
  const bascule = el("div", { class: "editeur-bascule" },
    el("button", { class: "btn on", type: "button", onClick: (e) => basculer(e, "edite") }, "Éditer"),
    el("button", { class: "btn", type: "button", onClick: (e) => basculer(e, "apercu") }, "Aperçu"),
  );
  function basculer(e, mode) {
    overlay.dataset.mode = mode;
    bascule.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
    e.currentTarget.classList.add("on");
    if (mode === "apercu") rafraichirApercu();
  }
  overlay.dataset.mode = "edite";

  const corps = el("div", { class: "editeur-corps" }, zone, apercu);
  const versionsPanneau = el("div", { class: "editeur-versions", hidden: true });

  overlay.appendChild(tete);
  overlay.appendChild(bandeau);
  overlay.appendChild(outils);
  overlay.appendChild(galerie);
  overlay.appendChild(bascule);
  overlay.appendChild(versionsPanneau);
  overlay.appendChild(corps);
  document.body.appendChild(overlay);
  document.body.classList.add("cours-open");

  // ===== Aperçu (avec un délai : re-rendre 20 000 caractères à chaque frappe
  // serait du gâchis ; 400 ms après la dernière frappe suffisent). =====
  let minuterie = null;
  function rafraichirApercu() {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      clear(apercu);
      rendreMarkdown(zone.value).noeuds.forEach((n) => apercu.appendChild(n));
    }, 400);
  }
  zone.addEventListener("input", () => { marquerNonSauve(); rafraichirApercu(); });
  rafraichirApercu();

  function marquerNonSauve() {
    sauve = false;
    btnEnregistrer.textContent = "Enregistrer *";
  }

  function message(texte, actions = []) {
    clear(bandeau);
    bandeau.hidden = false;
    bandeau.appendChild(el("span", {}, texte));
    for (const a of actions) {
      bandeau.appendChild(el("button", { class: "btn", type: "button", onClick: a.action }, a.label));
    }
  }
  function effacerMessage() { bandeau.hidden = true; clear(bandeau); }

  // ===== Enregistrement =====
  async function enregistrer({ ecraser = false } = {}) {
    effacerMessage();
    btnEnregistrer.disabled = true;
    try {
      if (ecraser) {
        // Écraser en connaissance de cause : on reprend le jeton frais.
        const frais = await getCours(numero);
        ouvertA = frais.updated_at;
      }
      const titre = titreDepuisMarkdown(zone.value) || cours.titre;
      const r = await saveCours(cours.id, {
        titre, corps_md: zone.value, who: getProfileWho() || "formateur", ouvertA,
      });
      if (r.conflit) {
        const quand = r.quand ? new Date(r.quand).toLocaleString("fr-FR") : "";
        message(`Modifié entre-temps par ${r.par || "quelqu'un d'autre"} (${quand}). Écraser sa version ?`, [
          { label: "Écraser", action: () => enregistrer({ ecraser: true }) },
          { label: "Abandonner", action: effacerMessage },
        ]);
        return;
      }
      ouvertA = r.cours.updated_at;
      sauve = true; aChange = true;
      btnEnregistrer.textContent = "Enregistré";
      setTimeout(() => { if (sauve) btnEnregistrer.textContent = "Enregistrer"; }, 1500);
      tete.querySelector(".cours-head-titre").textContent = r.cours.titre;
    } catch (e) {
      // Échec réseau ou droits : le texte reste dans la zone, rien n'est perdu.
      message("Échec de l'enregistrement : " + (e?.message || e) + ". Le texte reste ici, réessayer.", [
        { label: "Réessayer", action: () => enregistrer() },
      ]);
    } finally {
      btnEnregistrer.disabled = false;
    }
  }
  btnEnregistrer.addEventListener("click", () => enregistrer());

  // ===== Publication =====
  btnPublier.addEventListener("click", async () => {
    effacerMessage();
    const cible = btnPublier.textContent === "Publier";
    if (cible && !sauve) {
      message("Des modifications ne sont pas enregistrées : enregistrer d'abord, puis publier.");
      return;
    }
    btnPublier.disabled = true;
    try {
      await setCoursPublie(cours.id, cible);
      aChange = true;
      statut.textContent = cible ? "Publié" : "Non publié";
      btnPublier.textContent = cible ? "Dépublier" : "Publier";
    } catch (e) {
      message("Échec : " + (e?.message || e));
    } finally {
      btnPublier.disabled = false;
    }
  });

  // ===== Versions =====
  btnVersions.addEventListener("click", async () => {
    if (!versionsPanneau.hidden) { versionsPanneau.hidden = true; return; }
    galerie.hidden = true;
    clear(versionsPanneau);
    versionsPanneau.hidden = false;
    versionsPanneau.appendChild(el("p", { class: "muted" }, "Chargement…"));
    try {
      const liste = await listCoursVersions(cours.id);
      clear(versionsPanneau);
      if (!liste.length) {
        versionsPanneau.appendChild(el("p", { class: "muted" }, "Aucune version archivée."));
        return;
      }
      for (const v of liste) {
        const quand = new Date(v.saved_at).toLocaleString("fr-FR");
        versionsPanneau.appendChild(el("div", { class: "editeur-version" },
          el("span", {}, `${v.saved_by || "?"} · ${quand}`),
          el("button", { class: "btn", type: "button", onClick: async () => {
            // Restaurer remplit l'éditeur : l'enregistrement reste un acte
            // explicite (et créera sa propre version).
            const pleine = await getCoursVersion(v.id);
            zone.value = pleine.corps_md;
            marquerNonSauve();
            rafraichirApercu();
            versionsPanneau.hidden = true;
            message("Version chargée dans l'éditeur. Enregistrer pour la rétablir.");
          } }, "Restaurer"),
        ));
      }
    } catch (e) {
      clear(versionsPanneau);
      versionsPanneau.appendChild(el("p", { class: "muted" }, "Échec : " + (e?.message || e)));
    }
  });

  // ===== Fermeture =====
  function close() {
    if (!sauve) {
      message("Des modifications ne sont pas enregistrées.", [
        { label: "Enregistrer", action: () => enregistrer() },
        { label: "Quitter sans enregistrer", action: () => { sauve = true; close(); } },
      ]);
      return;
    }
    overlay.remove();
    document.body.classList.remove("cours-open");
    document.removeEventListener("keydown", onKey);
    if (onFerme) onFerme(aChange);
  }
  function onKey(e) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    // Échap referme d'abord ce qui est ouvert par-dessus l'éditeur.
    if (!galerie.hidden) { galerie.hidden = true; return; }
    if (!versionsPanneau.hidden) { versionsPanneau.hidden = true; return; }
    close();
  }
  fermer.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
}
