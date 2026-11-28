// Les coordonnées d'un stagiaire, sous l'en-tête de sa fiche (espace contact, tâche 6) : téléphone, e-mail du compte, financement
// et rang de délégué. Le stagiaire voit les siennes en lecture (son téléphone se change dans Mes préférences) ; l'équipe qui gère les
// stagiaires (la case Stagiaires à « Modifier », sinon isAdmin côté app ; la base reste juge et son refus s'affiche) les modifie : téléphone, financement dans la liste du
// centre, « délégué », « suppléant » ou « aucun ». Le bloc se charge seul : une lecture qui échoue laisse sa phrase et « Réessayer »,
// jamais la fiche vide. Équipe au vouvoiement, stagiaire au tutoiement.

import { lireCoordonnees, lireFinancements, getStagiaire, reglerCoordonnees, reglerDelegue } from "../db.js?v=20261128b";
import { el, clear, toast } from "../utils.js?v=20261128b";
import { icon } from "../icons.js?v=20261128b";
import { ecritSelonLaCase } from "../auth-admin.js?v=20261128b";
import { phraseDeRefus } from "../espaces-rules.js?v=20261128b";
import { ouvrirModale } from "../nav-fenetre.js?v=20261128b";
import { validerMaFiche, peutModifierCoordonnees } from "../contact-annuaire-rules.js?v=20261128b";

const LIBELLE_DELEGUE = { titulaire: "Délégué", suppleant: "Suppléant" };

const ligne = (nom, valeur) => el("div", { class: "contact-ligne" }, el("dt", {}, nom), el("dd", {}, valeur));

// `d` : les données de la fiche (d.id : le stagiaire). `soi` : c'est la fiche de la personne connectée. `direction` : la fiche est
// ouverte depuis la page des stagiaires de la direction.
export function blocCoordonnees(d, { soi = false, direction = false } = {}) {
  const bloc = el("section", { class: "fiche-coordonnees", "aria-label": "Coordonnées" });
  const modifiable = peutModifierCoordonnees({ soi, admin: ecritSelonLaCase("stagiaires"), direction });

  async function charger() {
    clear(bloc);
    bloc.appendChild(el("div", { class: "loading" }, "Chargement"));
    let coord;
    let financements = [];
    let ligneStagiaire = null;
    try {
      const [coordonnees, listeFin, fiche] = await Promise.all([
        lireCoordonnees(),
        modifiable ? lireFinancements() : Promise.resolve([]),
        getStagiaire(d.id).catch(() => d.stagiaireRow || null),
      ]);
      coord = coordonnees.find((c) => c.stagiaire_id === d.id) || {};
      financements = listeFin;
      ligneStagiaire = fiche;
    } catch (e) {
      console.error("coordonnées du stagiaire", e);
      if (!bloc.isConnected) return;
      clear(bloc);
      bloc.appendChild(el("div", { class: "contact-erreur", role: "alert" },
        el("p", {}, "Les coordonnées n'ont pas pu être chargées."),
        el("button", { class: "btn small", type: "button", onClick: charger }, "Réessayer")));
      return;
    }
    if (!bloc.isConnected) return;
    const delegue = ligneStagiaire?.delegue || null;
    const vide = soi ? "Pas renseigné" : "Non renseigné";
    const tel = coord.telephone
      ? el("a", { class: "contact-coord", href: "tel:" + String(coord.telephone).replace(/[^0-9+]/g, "") }, icon.phone(), coord.telephone)
      : vide;
    const mail = coord.email ? el("a", { class: "contact-coord", href: "mailto:" + coord.email }, icon.mail(), coord.email) : vide;
    clear(bloc);
    bloc.appendChild(el("div", { class: "contact-section-tete" },
      el("h3", { class: "contact-section-titre" }, "Coordonnées"),
      modifiable
        ? el("button", { class: "btn small", type: "button", onClick: (e) => ouvrirModification({ coord, financements, delegue, ancre: e.currentTarget }) },
          icon.pencil(), "Modifier")
        : null));
    bloc.appendChild(el("dl", { class: "contact-detail" },
      ligne("Téléphone", tel),
      ligne("E-mail", mail),
      ligne("Financement", coord.financement || vide),
      ligne(soi ? "Délégué de la promo" : "Délégué", delegue ? LIBELLE_DELEGUE[delegue] : "Non")));
    if (soi) {
      bloc.appendChild(el("p", { class: "contact-aide" }, "Ton téléphone se change dans ",
        el("a", { href: "#/preferences" }, "Mes préférences"), ". Seule l'équipe de ton centre le voit."));
    }
  }

  // La fenêtre : téléphone, financement (non retirés, plus celui déjà porté), rang de délégué.
  function ouvrirModification({ coord, financements, delegue, ancre }) {
    let modale = null;
    const erreurTel = el("p", { class: "contact-champ-erreur", role: "alert" });
    const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
    const telephone = el("input", { type: "tel", id: "coord-tel", value: coord.telephone ?? "", autocomplete: "off", maxlength: "20", inputmode: "tel" });
    const financement = el("select", { id: "coord-fin" }, el("option", { value: "" }, "Aucun"));
    for (const f of financements) {
      if (f.retire && f.id !== coord.financement_id) continue;
      financement.appendChild(el("option", { value: String(f.id), selected: f.id === coord.financement_id },
        f.libelle + (f.retire ? " (retiré)" : "")));
    }
    const rang = el("select", { id: "coord-delegue" },
      el("option", { value: "", selected: !delegue }, "Aucun"),
      el("option", { value: "titulaire", selected: delegue === "titulaire" }, "Délégué"),
      el("option", { value: "suppleant", selected: delegue === "suppleant" }, "Suppléant"));

    async function enregistrer(bouton) {
      general.textContent = "";
      erreurTel.textContent = "";
      const valeurTel = String(telephone.value).trim() === "" ? null : String(telephone.value).trim();
      const verdict = validerMaFiche({ telephone: valeurTel });
      if (!verdict.ok) { erreurTel.textContent = verdict.erreurs.telephone; telephone.focus(); return; }
      const valeurFin = financement.value === "" ? null : Number(financement.value);
      const valeurRang = rang.value === "" ? null : rang.value;
      bouton.disabled = true;
      try {
        // Le rang d'abord : c'est lui que la promo peut refuser (un seul délégué, un seul suppléant).
        if (valeurRang !== delegue) await reglerDelegue(d.id, valeurRang);
        const champs = {};
        if (valeurTel !== (coord.telephone ?? null)) champs.telephone = valeurTel;
        if (valeurFin !== (coord.financement_id ?? null)) champs.financement_id = valeurFin;
        if (Object.keys(champs).length) await reglerCoordonnees(d.id, champs);
        modale.fermer({ focus: false });
        toast("Coordonnées enregistrées.", "success", 1800);
        await charger();
      } catch (e) {
        console.error("coordonnées du stagiaire", e);
        general.textContent = phraseDeRefus(e.message, e.code);
        bouton.disabled = false;
        // Un rang déjà accepté puis un refus plus loin : la fiche se relit pour dire ce qui est vraiment enregistré.
        if (valeurRang !== delegue) charger();
      }
    }
    const bouton = el("button", { class: "btn primary", type: "button", onClick: () => enregistrer(bouton) }, icon.check(), "Enregistrer");
    const fenetre = el("div", { class: "modal contact-modal" },
      el("h3", {}, "Modifier les coordonnées"),
      el("div", { class: "modal-form" },
        el("div", { class: "field" }, el("label", { for: "coord-tel" }, "Téléphone"), telephone, erreurTel),
        el("div", { class: "field" }, el("label", { for: "coord-fin" }, "Financement"), financement),
        el("div", { class: "field" }, el("label", { for: "coord-delegue" }, "Rang dans la promo"), rang,
          el("p", { class: "contact-aide" }, "Un délégué et un suppléant au plus par promo.")),
        general),
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => modale.demanderFermeture() }, "Annuler"),
        bouton));
    modale = ouvrirModale(fenetre, { retour: ancre, focus: () => telephone });
  }

  charger();
  return bloc;
}
