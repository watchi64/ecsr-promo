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
import { el, clear } from "../utils.js?v=20260809b";
import { icon } from "../icons.js?v=20260809b";
import { getCours, saveCours, setCoursPublie, listCoursVersions, getCoursVersion, uploadCoursImage }
  from "../db.js?v=20260809b";
import { rendreMarkdown } from "./cours-reader.js?v=20260809b";
import { insererSyntaxe, titreDepuisMarkdown, cheminImage } from "../cours-rules.js?v=20260809b";
import { getProfileWho } from "../auth-admin.js?v=20260809b";
import { reduireImage } from "../cours-images.js?v=20260809b";

const OUTILS = [
  { label: "Gras", avant: "**", apres: "**", defaut: "texte" },
  { label: "Titre", avant: "\n### ", apres: "\n", defaut: "Sous-partie" },
  { label: "Tableau", avant: "\n| Situation | Règle |\n|---|---|\n| ", apres: " |  |\n", defaut: "cas" },
  { label: "Panneaux", avant: "\n:::signaux ", apres: "\nLégende.\n:::\n", defaut: "AB1" },
  { label: "Marquage", avant: "\n:::marquage ", apres: "\nLégende.\n:::\n", defaut: "T1" },
];

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

  const outils = el("div", { class: "editeur-outils" });
  for (const o of OUTILS) {
    const b = el("button", { class: "btn", type: "button" }, o.label);
    b.addEventListener("click", () => {
      const r = insererSyntaxe(zone.value, zone.selectionStart, zone.selectionEnd,
        o.avant, o.apres, o.defaut);
      zone.value = r.texte;
      zone.focus();
      zone.setSelectionRange(r.debutSel, r.finSel);
      marquerNonSauve();
      rafraichirApercu();
    });
    outils.appendChild(b);
  }
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
      const r = insererSyntaxe(zone.value, zone.selectionStart, zone.selectionEnd,
        "\n![", `](${url})\n`, "légende");
      zone.value = r.texte;
      zone.setSelectionRange(r.debutSel, r.finSel);
      marquerNonSauve();
      rafraichirApercu();
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
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  fermer.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
}
