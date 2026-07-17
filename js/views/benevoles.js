// Panneau « Élèves bénévoles et partenaires » : banque des volontaires qui viennent
// conduire avec les élèves moniteurs (activité Voiture conduite) + banque des
// auto-écoles partenaires (contacts pour en recruter) + fiche de suivi des venues.
// Réservé formateur/admin : le bouton d'ouverture n'est rendu que pour eux et les
// tables sont RLS admin-only (téléphones jamais transmis aux stagiaires). Les venues
// ne sont pas stockées : déduites du planning (cartes portant le bénévole), seuls
// les commentaires vivent dans benevole_suivi. Ouvert depuis la barre semaine du Planning.
import {
  listBenevoles, addBenevole, updateBenevole, setBenevoleActif,
  listAutoEcoles, addAutoEcole, updateAutoEcole, setAutoEcoleActif, deleteAutoEcole,
  listVenuesBenevoles, listSuiviBenevole, upsertSuiviBenevole, listStagiaires,
} from "../db.js?v=20260717c";
import { el, clear, toast, displayStagiaire, compareByNom, isoDate, addDays, formatDayShort } from "../utils.js?v=20260717c";
import { JOURS } from "../config.js?v=20260717c";

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const DEMI = [
  { key: "matin", label: "matin", court: "m" },
  { key: "aprem", label: "après-midi", court: "am" },
];
// Compétences REMC (permis B) avec leurs sous-compétences : intitulés alignés sur la
// table themes (type notion, préfixe « REMC Cx.y »). Le niveau stocké en base est le
// CODE seul (« C1 », « C1.4 »...), le libellé est résolu à l'affichage via nivLabel().
export const COMPETENCES_REMC = [
  { code: "C1", titre: "Maîtriser le maniement du véhicule dans un trafic faible ou nul",
    sous: [
      ["C1.1", "Connaître les principaux organes et commandes, vérifications intérieures/extérieures"],
      ["C1.2", "Entrer, s'installer au poste de conduite et en sortir"],
      ["C1.3", "Tenir, tourner le volant et maintenir la trajectoire"],
      ["C1.4", "Démarrer et s'arrêter"],
      ["C1.5", "Doser l'accélération et le freinage à diverses allures"],
      ["C1.6", "Utiliser la boîte de vitesses"],
      ["C1.7", "Diriger la voiture en avant, en ligne droite et en courbe (allure et trajectoire)"],
      ["C1.8", "Regarder autour de soi et avertir"],
      ["C1.9", "Effectuer une marche arrière et un demi-tour en sécurité"],
    ] },
  { code: "C2", titre: "Appréhender la route et circuler dans des conditions normales",
    sous: [
      ["C2.1", "Connaître les principales règles de circulation et la signalisation"],
      ["C2.2", "Tenir compte de la signalisation verticale et horizontale"],
      ["C2.3", "Rechercher les indices utiles"],
      ["C2.4", "Utiliser toutes les commandes"],
      ["C2.5", "Adapter sa vitesse aux situations"],
      ["C2.6", "Choisir la voie de circulation"],
      ["C2.7", "Maintenir les distances de sécurité"],
      ["C2.8", "Franchir les différents types d'intersection et y changer de direction"],
    ] },
  { code: "C3", titre: "Circuler dans des conditions difficiles et partager la route",
    sous: [
      ["C3.1", "Évaluer et maintenir les distances de sécurité"],
      ["C3.2", "Croiser, dépasser, être dépassé"],
      ["C3.3", "Passer les virages et conduire en déclivité"],
      ["C3.4", "Connaître et respecter les autres usagers (respect et courtoisie)"],
      ["C3.5", "S'insérer, circuler et sortir d'une voie rapide"],
      ["C3.6", "Conduire dans une file de véhicule et dans une circulation dense"],
      ["C3.7", "Conduire quand l'adhérence et la visibilité sont réduites"],
    ] },
  { code: "C4", titre: "Pratiquer une conduite autonome, sûre et économique",
    sous: [
      ["C4.1", "Suivre un itinéraire de façon autonome"],
      ["C4.2", "Préparer et effectuer un voyage longue distance en autonomie"],
      ["C4.3", "Connaître les principaux facteurs de risque au volant et recommandations"],
      ["C4.4", "Comportements en cas d'accident : protéger, alerter, secourir"],
      ["C4.5", "Faire l'expérience des aides à la conduite (régulateur, limiteur, ABS, navigation)"],
      ["C4.6", "Notions sur l'entretien, le dépannage et les situations d'urgence"],
      ["C4.7", "Pratiquer l'éco-conduite"],
    ] },
];
const BOITES = ["Manuelle", "Automatique"];

// « C1.4 » -> « C1.4 · Démarrer et s'arrêter » ; « C1 » -> « C1 · Maîtriser le maniement... »
export function nivLabel(code) {
  if (!code) return "";
  for (const c of COMPETENCES_REMC) {
    if (c.code === code) return `${c.code} · ${c.titre}`;
    const s = c.sous.find(([sc]) => sc === code);
    if (s) return `${s[0]} · ${s[1]}`;
  }
  return code;  // valeur inconnue : on affiche telle quelle
}

function jourLong(j) { return j.charAt(0) + j.slice(1).toLowerCase(); }

// Badges compacts des dispos récurrentes : « Lun m », « Mar m+am »...
function dispoBadges(b) {
  const wrap = el("span", { class: "bnv-badges" });
  JOURS.forEach((j, i) => {
    const halves = (b.dispos?.[j] || [])
      .map((h) => DEMI.find((d) => d.key === h)?.court)
      .filter(Boolean);
    if (halves.length) wrap.appendChild(el("span", { class: "bnv-badge" }, `${JOURS_COURTS[i]} ${halves.join("+")}`));
  });
  if (!wrap.children.length) wrap.appendChild(el("span", { class: "bnv-badge empty" }, "dispos non renseignées"));
  return wrap;
}

function telLink(tel) {
  if (!tel || !String(tel).trim()) return null;
  return el("a", { class: "bnv-tel", href: "tel:" + String(tel).replace(/[^+\d]/g, "") }, tel);
}

function mailLink(email) {
  if (!email || !String(email).trim()) return null;
  // bnv-mail : contrairement au téléphone (court, insécable), un email peut être
  // long → il doit pouvoir se couper pour ne jamais faire déborder la modale.
  return el("a", { class: "bnv-tel bnv-mail", href: "mailto:" + String(email).trim() }, email);
}

export function openBenevolesPanel({ onClose } = {}) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal bnv-modal" });
  backdrop.appendChild(modal);

  let list = [];
  let ecoles = [];
  let venues = [];        // cartes planning portant des bénévoles (venues déduites)
  let stagiaires = [];    // pour nommer les élèves moniteurs dans le suivi
  let tab = "benevoles";  // "benevoles" | "ecoles"
  let filtre = { jour: "", demi: "" };
  let dirty = false;  // au moins une écriture => le planning recharge sa banque à la fermeture

  const close = () => { backdrop.remove(); if (dirty && onClose) onClose(); };
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

  async function reload() {
    [list, ecoles, venues, stagiaires] = await Promise.all([
      listBenevoles(), listAutoEcoles(), listVenuesBenevoles(), listStagiaires(),
    ]);
  }

  function ecoleNom(id) { return ecoles.find((a) => a.id === id)?.nom || ""; }
  function stagiaireNom(id) {
    const s = stagiaires.find((x) => x.id === id);
    return s ? displayStagiaire(s) : "";
  }

  function metaLine(b, nbVenues) {
    const parts = [
      b.boite,
      (b.heures != null && b.heures !== "") ? `${b.heures}h` : null,
      ecoleNom(b.auto_ecole_id) || null,
      nbVenues ? `${nbVenues} venue${nbVenues > 1 ? "s" : ""}` : null,
    ].filter((v) => v != null && String(v).trim() !== "");
    return parts.join(" · ");
  }

  // Venues d'un bénévole : regroupe les cartes planning par demi-journée
  // (plusieurs créneaux successifs la même demi-journée = une seule venue).
  function venuesFor(benevoleId) {
    const map = new Map();  // clé "semaine|jour|demi" -> venue
    venues.forEach((e) => {
      if (!(e.benevoles_ids || []).includes(benevoleId)) return;
      const key = `${e.semaine_lundi}|${e.day_index}|${e.half_day}`;
      if (!map.has(key)) {
        map.set(key, { semaine_lundi: e.semaine_lundi, day_index: e.day_index,
          half_day: e.half_day, eleves: new Set(), sujets: new Set() });
      }
      const vn = map.get(key);
      (e.eleves_ids || []).forEach((id) => vn.eleves.add(id));
      if (e.sujet && String(e.sujet).trim()) vn.sujets.add(String(e.sujet).trim());
    });
    return [...map.values()].sort((a, b) =>
      b.semaine_lundi.localeCompare(a.semaine_lundi) || b.day_index - a.day_index
      || (b.half_day === "aprem" ? 1 : 0) - (a.half_day === "aprem" ? 1 : 0));
  }

  function venueCount(benevoleId) { return venuesFor(benevoleId).length; }

  function venueDate(vn) {
    const monday = new Date(vn.semaine_lundi + "T00:00:00");
    return addDays(monday, vn.day_index);
  }

  function venueLabel(dayIndex, date, half) {
    return `${JOURS_COURTS[dayIndex]} ${formatDayShort(date)} ${half === "matin" ? "matin" : "après-midi"}`;
  }

  // === Onglets ===

  function renderTabs() {
    const tabs = el("div", { class: "bnv-tabs" });
    [["benevoles", "Bénévoles"], ["ecoles", "Auto-écoles"]].forEach(([key, label]) => {
      tabs.appendChild(el("button", {
        class: "bnv-tab" + (tab === key ? " active" : ""), type: "button",
        onClick: () => { if (tab !== key) { tab = key; render(); } },
      }, label));
    });
    return tabs;
  }

  function render() { if (tab === "ecoles") renderEcoles(); else renderList(); }

  function matchesFiltre(b) {
    const d = b.dispos || {};
    if (filtre.jour && filtre.demi) return (d[filtre.jour] || []).includes(filtre.demi);
    if (filtre.jour) return (d[filtre.jour] || []).length > 0;
    if (filtre.demi) return JOURS.some((j) => (d[j] || []).includes(filtre.demi));
    return true;
  }

  // === Onglet Bénévoles ===

  function renderList() {
    clear(modal);
    modal.appendChild(el("h3", {}, "Élèves bénévoles et partenaires"));
    modal.appendChild(renderTabs());
    modal.appendChild(el("p", { class: "muted bnv-intro" },
      "Volontaires qui viennent conduire avec les élèves moniteurs. Visible uniquement par les formateurs/admins."));

    // Filtre dispo + ajout
    const jourSel = el("select");
    jourSel.appendChild(el("option", { value: "" }, "Tous les jours"));
    JOURS.forEach((j) => jourSel.appendChild(el("option", { value: j }, jourLong(j))));
    jourSel.value = filtre.jour;
    jourSel.addEventListener("change", () => { filtre.jour = jourSel.value; renderList(); });

    const demiSel = el("select");
    demiSel.appendChild(el("option", { value: "" }, "Matin + après-midi"));
    DEMI.forEach((d) => demiSel.appendChild(el("option", { value: d.key }, d.label)));
    demiSel.value = filtre.demi;
    demiSel.addEventListener("change", () => { filtre.demi = demiSel.value; renderList(); });

    const addBtn = el("button", { class: "btn small primary", onClick: () => renderForm(null) }, "+ Ajouter");
    modal.appendChild(el("div", { class: "bnv-toolbar" },
      el("span", { class: "bnv-filter-label" }, "Dispo :"), jourSel, demiSel,
      el("span", { style: "flex:1" }), addBtn));

    const actifs = list.filter((b) => b.actif !== false).filter(matchesFiltre).sort(compareByNom);
    const retires = list.filter((b) => b.actif === false).sort(compareByNom);

    if (!actifs.length) {
      modal.appendChild(el("p", { class: "muted bnv-empty" },
        list.length ? "Personne ne correspond à ce filtre." : "Banque vide. Ajoute un premier bénévole."));
    }
    actifs.forEach((b) => {
      const row = el("div", { class: "bnv-row" });
      const info = el("div", { class: "bnv-info" });
      info.appendChild(el("div", { class: "bnv-name" }, displayStagiaire(b)));
      if (b.niveau) info.appendChild(el("div", { class: "bnv-niveau" }, nivLabel(b.niveau)));
      const meta = metaLine(b, venueCount(b.id));
      if (meta) info.appendChild(el("div", { class: "bnv-meta" }, meta));
      info.appendChild(dispoBadges(b));
      if (b.dispo_note) info.appendChild(el("div", { class: "bnv-note" }, b.dispo_note));
      row.appendChild(info);
      const side = el("div", { class: "bnv-side" });
      const tel = telLink(b.telephone);
      if (tel) side.appendChild(tel);
      side.appendChild(el("button", { class: "btn small ghost", onClick: () => renderForm(b) }, "Modifier"));
      row.appendChild(side);
      modal.appendChild(row);
    });

    if (retires.length) {
      const det = el("details", { class: "bnv-retires" });
      det.appendChild(el("summary", {}, `Retirés de la banque (${retires.length})`));
      retires.forEach((b) => {
        det.appendChild(el("div", { class: "bnv-row inactive" },
          el("div", { class: "bnv-info" }, el("div", { class: "bnv-name" }, displayStagiaire(b))),
          el("div", { class: "bnv-side" },
            el("button", { class: "btn small ghost", onClick: async () => {
              try {
                await setBenevoleActif(b.id, true); dirty = true; await reload(); render();
              } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            }}, "Réactiver"))));
      });
      modal.appendChild(det);
    }

    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  }

  // === Onglet Auto-écoles ===

  function renderEcoles() {
    clear(modal);
    modal.appendChild(el("h3", {}, "Élèves bénévoles et partenaires"));
    modal.appendChild(renderTabs());
    modal.appendChild(el("p", { class: "muted bnv-intro" },
      "Auto-écoles partenaires : les contacts à appeler pour trouver des élèves bénévoles."));

    const addBtn = el("button", { class: "btn small primary", onClick: () => renderEcoleForm(null) }, "+ Ajouter");
    modal.appendChild(el("div", { class: "bnv-toolbar" }, el("span", { style: "flex:1" }), addBtn));

    const tri = (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr");
    const actives = ecoles.filter((a) => a.actif !== false).sort(tri);
    const retirees = ecoles.filter((a) => a.actif === false).sort(tri);

    if (!actives.length) {
      modal.appendChild(el("p", { class: "muted bnv-empty" }, "Aucune auto-école partenaire pour l'instant."));
    }
    actives.forEach((a) => {
      const affilies = list.filter((b) => b.auto_ecole_id === a.id && b.actif !== false);
      const row = el("div", { class: "bnv-row" });
      const info = el("div", { class: "bnv-info" });
      info.appendChild(el("div", { class: "bnv-name" }, a.nom));
      const metaParts = [a.referent, affilies.length ? `${affilies.length} bénévole${affilies.length > 1 ? "s" : ""}` : null]
        .filter(Boolean).join(" · ");
      if (metaParts) info.appendChild(el("div", { class: "bnv-meta" }, metaParts));
      if (a.notes) info.appendChild(el("div", { class: "bnv-note" }, a.notes));
      row.appendChild(info);
      const side = el("div", { class: "bnv-side" });
      const tel = telLink(a.telephone); if (tel) side.appendChild(tel);
      const mail = mailLink(a.email); if (mail) side.appendChild(mail);
      side.appendChild(el("button", { class: "btn small ghost", onClick: () => renderEcoleForm(a) }, "Modifier"));
      row.appendChild(side);
      modal.appendChild(row);
    });

    if (retirees.length) {
      const det = el("details", { class: "bnv-retires" });
      det.appendChild(el("summary", {}, `Retirées (${retirees.length})`));
      retirees.forEach((a) => {
        det.appendChild(el("div", { class: "bnv-row inactive" },
          el("div", { class: "bnv-info" }, el("div", { class: "bnv-name" }, a.nom)),
          el("div", { class: "bnv-side" },
            el("button", { class: "btn small ghost", onClick: async () => {
              try { await setAutoEcoleActif(a.id, true); dirty = true; await reload(); render(); }
              catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            }}, "Réactiver"))));
      });
      modal.appendChild(det);
    }

    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  }

  // Fiche auto-école. onSaved (optionnel) sert au flux « + Nouvelle auto-école »
  // depuis la fiche bénévole : appelé avec la fiche créée (ou null si annulation)
  // au lieu de revenir à la liste.
  function renderEcoleForm(a, onSaved) {
    clear(modal);
    modal.appendChild(el("h3", {}, a ? "Modifier " + a.nom : "Nouvelle auto-école"));

    const nomIn = el("input", { type: "text", value: a?.nom || "", autocomplete: "off" });
    const referentIn = el("input", { type: "text", value: a?.referent || "", autocomplete: "off", placeholder: "Sophie…" });
    const telIn = el("input", { type: "tel", value: a?.telephone || "", autocomplete: "off", placeholder: "06 12 34 56 78" });
    const emailIn = el("input", { type: "email", value: a?.email || "", autocomplete: "off" });
    const adresseIn = el("input", { type: "text", value: a?.adresse || "", autocomplete: "off" });
    const notesIn = el("input", { type: "text", value: a?.notes || "", autocomplete: "off" });

    async function save() {
      const nom = nomIn.value.trim();
      if (!nom) { toast("Nom obligatoire", "error"); return; }
      const payload = {
        nom,
        referent: referentIn.value.trim() || null,
        telephone: telIn.value.trim() || null,
        email: emailIn.value.trim() || null,
        adresse: adresseIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      try {
        let saved = a;
        if (a) await updateAutoEcole(a.id, payload);
        else saved = await addAutoEcole(payload);
        dirty = true;
        await reload();
        if (onSaved) onSaved(saved); else render();
      } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
    }

    modal.appendChild(el("div", { class: "modal-form" },
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Nom *"), nomIn),
        el("div", { class: "field" }, el("label", {}, "Référent (qui appeler)"), referentIn)),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Téléphone"), telIn),
        el("div", { class: "field" }, el("label", {}, "Email"), emailIn)),
      el("div", { class: "field" }, el("label", {}, "Adresse"), adresseIn),
      el("div", { class: "field" }, el("label", {}, "Notes"), notesIn),
    ));

    // Ses bénévoles : l'outil « reprendre contact avec ses élèves ». Gestion
    // complète depuis la fiche : ouvrir une fiche (nom cliquable, avec retour ici),
    // désaffilier (×), affilier un existant ou en créer un déjà affilié.
    if (a) {
      // Rouvre cette fiche avec des données fraîches après une écriture
      const reopenEcole = () => {
        const fresh = ecoles.find((x) => x.id === a.id);
        if (fresh) renderEcoleForm(fresh, onSaved);
        else { tab = "ecoles"; render(); }
      };

      const affilies = list.filter((b) => b.auto_ecole_id === a.id && b.actif !== false).sort(compareByNom);
      const bloc = el("div", { class: "bnv-affilies" });
      bloc.appendChild(el("div", { class: "bnv-affilies-titre" }, `Ses bénévoles (${affilies.length})`));
      if (!affilies.length) bloc.appendChild(el("p", { class: "muted bnv-empty" }, "Aucun bénévole affilié."));
      affilies.forEach((b) => {
        const line = el("div", { class: "bnv-affilie" },
          el("button", { class: "bnv-affilie-nom bnv-linklike", type: "button",
            title: "Ouvrir la fiche de " + displayStagiaire(b),
            onClick: () => renderForm(b, null, reopenEcole) }, displayStagiaire(b)));
        if (b.niveau) line.appendChild(el("span", { class: "bnv-affilie-niv" }, b.niveau));
        const tel = telLink(b.telephone); if (tel) line.appendChild(tel);
        line.appendChild(el("button", { class: "bnv-affilie-x", type: "button",
          title: "Désaffilier de cette auto-école (reste dans la banque)",
          onClick: async () => {
            if (!confirm(`Désaffilier ${displayStagiaire(b)} de ${a.nom} ? (reste dans la banque)`)) return;
            try { await updateBenevole(b.id, { auto_ecole_id: null }); dirty = true; await reload(); reopenEcole(); }
            catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
          }}, "×"));
        bloc.appendChild(line);
      });

      // Affilier un bénévole existant (ceux d'une autre auto-école sont déplaçables)
      // ou en créer un nouveau, déjà rattaché à cette auto-école.
      const affSel = el("select", { class: "bnv-affilie-add" });
      affSel.appendChild(el("option", { value: "" }, "Affilier un bénévole…"));
      list.filter((x) => x.actif !== false && x.auto_ecole_id !== a.id).sort(compareByNom)
        .forEach((x) => affSel.appendChild(el("option", { value: String(x.id) },
          displayStagiaire(x) + (x.auto_ecole_id ? ` (${ecoleNom(x.auto_ecole_id)})` : ""))));
      affSel.appendChild(el("option", { value: "__new" }, "+ Nouveau bénévole"));
      affSel.addEventListener("change", async () => {
        const val = affSel.value;
        if (!val) return;
        if (val === "__new") { renderForm(null, { auto_ecole_id: a.id }, reopenEcole); return; }
        try { await updateBenevole(Number(val), { auto_ecole_id: a.id }); dirty = true; await reload(); reopenEcole(); }
        catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
      });
      bloc.appendChild(affSel);
      modal.appendChild(bloc);
    }

    const actions = el("div", { class: "modal-actions" });
    if (a && a.actif !== false) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        if (!confirm(`Retirer ${a.nom} des partenaires ? (réactivable ensuite)`)) return;
        try { await setAutoEcoleActif(a.id, false); dirty = true; await reload(); render(); }
        catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
      }}, "Retirer"));
    }
    if (a) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        const nb = list.filter((x) => x.auto_ecole_id === a.id).length;  // inactifs compris
        const msg = nb
          ? `Supprimer définitivement ${a.nom} ?\n\nSes ${nb} bénévole(s) resteront dans la banque, sans auto-école.`
          : `Supprimer définitivement ${a.nom} ?`;
        if (!confirm(msg)) return;
        try { await deleteAutoEcole(a.id); dirty = true; await reload(); tab = "ecoles"; render(); }
        catch (e) { console.error(e); toast("Erreur de suppression", "error"); }
      }}, "Supprimer"));
    }
    actions.appendChild(el("span", { style: "flex:1" }));
    actions.appendChild(el("button", { class: "btn ghost", onClick: () => (onSaved ? onSaved(null) : render()) }, "Annuler"));
    actions.appendChild(el("button", { class: "btn primary", onClick: save }, "Enregistrer"));
    modal.appendChild(actions);
  }

  // === Fiche bénévole ===
  // draft (optionnel) : valeurs en cours de saisie, pour restaurer le formulaire au
  // retour du flux « + Nouvelle auto-école » sans perdre ce qui était déjà rempli.
  function renderForm(b, draft, returnTo) {
    clear(modal);
    // returnTo (optionnel) : où revenir après enregistrer/annuler/retirer
    // (ex. fiche auto-école qui a ouvert cette fiche). Par défaut : l'onglet courant.
    const done = () => (returnTo ? returnTo() : render());
    modal.appendChild(el("h3", {}, b ? "Modifier " + displayStagiaire(b) : "Nouveau bénévole"));

    const v = (champ, defaut) => (draft && champ in draft ? draft[champ] : defaut);

    const prenomIn = el("input", { type: "text", value: v("prenom", b?.prenom || ""), autocomplete: "off" });
    const nomIn = el("input", { type: "text", value: v("nom", b?.nom || ""), autocomplete: "off" });
    const telIn = el("input", { type: "tel", value: v("telephone", b?.telephone || ""), autocomplete: "off", placeholder: "06 12 34 56 78" });
    const heuresIn = el("input", { type: "number", min: "0", step: "0.5", value: v("heures", b?.heures ?? "") });
    const dispoNoteIn = el("input", { type: "text", value: v("dispo_note", b?.dispo_note || ""), autocomplete: "off", placeholder: "à partir de 17h, pas pendant ses exams…" });
    const notesIn = el("input", { type: "text", value: v("notes", b?.notes || ""), autocomplete: "off" });

    // Niveau : compétence globale (C1..C4) ou sous-compétence précise (C1.4...),
    // groupées par compétence. C1 et C2 sont les plus utilisées (début de formation).
    const niveauSel = el("select", { class: "bnv-niveau-select" });
    niveauSel.appendChild(el("option", { value: "" }, "Niveau…"));
    COMPETENCES_REMC.forEach((c) => {
      const group = el("optgroup", { label: `${c.code} · ${c.titre}` });
      group.appendChild(el("option", { value: c.code }, `${c.code} (global)`));
      c.sous.forEach(([code, titre]) => group.appendChild(el("option", { value: code }, `${code} · ${titre}`)));
      niveauSel.appendChild(group);
    });
    niveauSel.value = v("niveau", b?.niveau || "");

    const boiteSel = el("select");
    boiteSel.appendChild(el("option", { value: "" }, "Boîte…"));
    BOITES.forEach((x) => boiteSel.appendChild(el("option", { value: x }, x)));
    boiteSel.value = v("boite", b?.boite || "");

    // Affiliation : select depuis la banque + création à la volée pendant un appel
    const ecoleSel = el("select");
    ecoleSel.appendChild(el("option", { value: "" }, "Auto-école…"));
    ecoles.filter((x) => x.actif !== false)
      .sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"))
      .forEach((x) => ecoleSel.appendChild(el("option", { value: String(x.id) }, x.nom)));
    ecoleSel.appendChild(el("option", { value: "__new" }, "+ Nouvelle auto-école"));
    const ecoleInit = v("auto_ecole_id", b?.auto_ecole_id ?? null);
    ecoleSel.value = ecoleInit != null && ecoleInit !== "" ? String(ecoleInit) : "";

    // Grille de dispos récurrentes : 5 jours x 2 demi-journées
    const dispoSource = v("dispos", b?.dispos);
    const dispoState = {};
    JOURS.forEach((j) => { dispoState[j] = new Set(dispoSource?.[j] || []); });
    const grid = el("div", { class: "bnv-dispo-grid" });
    grid.appendChild(el("span", {}, ""));
    DEMI.forEach((d) => grid.appendChild(el("span", { class: "bnv-dispo-head" }, d.label)));
    JOURS.forEach((j, i) => {
      grid.appendChild(el("span", { class: "bnv-dispo-jour" }, JOURS_COURTS[i]));
      DEMI.forEach((d) => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = dispoState[j].has(d.key);
        cb.addEventListener("change", () => {
          if (cb.checked) dispoState[j].add(d.key);
          else dispoState[j].delete(d.key);
        });
        grid.appendChild(el("label", { class: "bnv-dispo-cell" }, cb));
      });
    });

    function collectDraft() {
      const dispos = {};
      JOURS.forEach((j) => { if (dispoState[j].size) dispos[j] = [...dispoState[j]]; });
      return {
        prenom: prenomIn.value, nom: nomIn.value, telephone: telIn.value,
        niveau: niveauSel.value, boite: boiteSel.value, heures: heuresIn.value,
        auto_ecole_id: ecoleSel.value && ecoleSel.value !== "__new" ? Number(ecoleSel.value) : null,
        dispos, dispo_note: dispoNoteIn.value, notes: notesIn.value,
      };
    }

    ecoleSel.addEventListener("change", () => {
      if (ecoleSel.value !== "__new") return;
      const d = collectDraft();
      renderEcoleForm(null, (saved) => {
        if (saved) d.auto_ecole_id = saved.id;
        renderForm(b, d, returnTo);
      });
    });

    async function save() {
      const prenom = prenomIn.value.trim();
      if (!prenom) { toast("Prénom obligatoire", "error"); return; }
      const dispos = {};
      JOURS.forEach((j) => { if (dispoState[j].size) dispos[j] = [...dispoState[j]]; });
      const payload = {
        prenom,
        nom: nomIn.value.trim() || null,
        telephone: telIn.value.trim() || null,
        niveau: niveauSel.value || null,
        boite: boiteSel.value || null,
        heures: heuresIn.value === "" ? null : Number(heuresIn.value),
        auto_ecole_id: ecoleSel.value && ecoleSel.value !== "__new" ? Number(ecoleSel.value) : null,
        dispos,
        dispo_note: dispoNoteIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      try {
        if (b) await updateBenevole(b.id, payload);
        else await addBenevole(payload);
        dirty = true;
        await reload();
        done();
      } catch (e) {
        console.error(e);
        toast("Erreur d'enregistrement", "error");
      }
    }

    const form = el("div", { class: "modal-form" },
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Prénom *"), prenomIn),
        el("div", { class: "field" }, el("label", {}, "Nom (optionnel)"), nomIn)),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Téléphone (visible formateurs)"), telIn),
        el("div", { class: "field" }, el("label", {}, "Auto-école d'origine"), ecoleSel)),
      el("div", { class: "field" }, el("label", {}, "Niveau"), niveauSel),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Boîte"), boiteSel),
        el("div", { class: "field" }, el("label", {}, "Heures faites"), heuresIn)),
      el("div", { class: "field" }, el("label", {}, "Disponibilités récurrentes"), grid),
      el("div", { class: "field" }, el("label", {}, "Précision dispos"), dispoNoteIn),
      el("div", { class: "field" }, el("label", {}, "Notes"), notesIn),
    );
    modal.appendChild(form);

    // === Suivi des venues (bénévole existant) : déduit du planning, commentaire
    // par venue passée (upsert benevole_suivi au blur). ===
    if (b) {
      const suiviBloc = el("div", { class: "bnv-suivi" });
      suiviBloc.appendChild(el("div", { class: "bnv-affilies-titre" }, "Suivi des venues"));
      suiviBloc.appendChild(el("p", { class: "muted bnv-empty" }, "Chargement du suivi…"));
      modal.appendChild(suiviBloc);

      listSuiviBenevole(b.id).then((rows) => {
        clear(suiviBloc);
        suiviBloc.appendChild(el("div", { class: "bnv-affilies-titre" }, "Suivi des venues"));
        const comByKey = new Map(rows.map((r) => [`${r.semaine_lundi}|${r.day_index}|${r.half_day}`, r]));
        const vns = venuesFor(b.id);
        const todayIso = isoDate(new Date());

        if (!vns.length && !rows.length) {
          suiviBloc.appendChild(el("p", { class: "muted bnv-empty" }, "Aucune venue planifiée pour l'instant."));
        }

        vns.forEach((vn) => {
          const key = `${vn.semaine_lundi}|${vn.day_index}|${vn.half_day}`;
          const date = venueDate(vn);
          const futur = isoDate(date) > todayIso;
          const head = el("div", { class: "bnv-venue-head" },
            el("span", { class: "bnv-venue-date" }, venueLabel(vn.day_index, date, vn.half_day)));
          const noms = [...vn.eleves].map(stagiaireNom).filter(Boolean).join(", ");
          if (noms) head.appendChild(el("span", { class: "bnv-venue-avec" }, "avec " + noms));
          if (futur) head.appendChild(el("span", { class: "bnv-venue-futur" }, "à venir"));
          const venueEl = el("div", { class: "bnv-venue" }, head);
          if (vn.sujets.size) venueEl.appendChild(el("div", { class: "bnv-venue-sujet" }, [...vn.sujets].join(", ")));
          if (!futur) {
            const com = comByKey.get(key);
            const input = el("input", { type: "text", class: "bnv-venue-com",
              placeholder: "+ commentaire de séance", value: com?.commentaire || "", autocomplete: "off" });
            input.addEventListener("blur", async () => {
              const val = input.value.trim();
              if (val === (com?.commentaire || "")) return;
              try {
                await upsertSuiviBenevole({ benevole_id: b.id, semaine_lundi: vn.semaine_lundi,
                  day_index: vn.day_index, half_day: vn.half_day, commentaire: val || null });
                if (com) com.commentaire = val;
                else comByKey.set(key, { semaine_lundi: vn.semaine_lundi, day_index: vn.day_index,
                  half_day: vn.half_day, commentaire: val });
              } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            });
            venueEl.appendChild(input);
          }
          suiviBloc.appendChild(venueEl);
        });

        // Commentaires dont le créneau a disparu du planning
        const vnKeys = new Set(vns.map((vn) => `${vn.semaine_lundi}|${vn.day_index}|${vn.half_day}`));
        rows.filter((r) => r.commentaire && !vnKeys.has(`${r.semaine_lundi}|${r.day_index}|${r.half_day}`))
          .forEach((r) => {
            const monday = new Date(r.semaine_lundi + "T00:00:00");
            const date = addDays(monday, r.day_index);
            suiviBloc.appendChild(el("div", { class: "bnv-venue orpheline" },
              el("div", { class: "bnv-venue-head" },
                el("span", { class: "bnv-venue-date" }, venueLabel(r.day_index, date, r.half_day)),
                el("span", { class: "bnv-venue-futur" }, "créneau retiré du planning")),
              el("div", { class: "bnv-venue-sujet" }, r.commentaire)));
          });
      }).catch((e) => { console.error(e); });
    }

    const actions = el("div", { class: "modal-actions" });
    if (b && b.actif !== false) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        if (!confirm(`Retirer ${displayStagiaire(b)} de la banque ? (réactivable ensuite)`)) return;
        try {
          await setBenevoleActif(b.id, false); dirty = true; await reload(); done();
        } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
      }}, "Retirer de la banque"));
    }
    actions.appendChild(el("span", { style: "flex:1" }));
    actions.appendChild(el("button", { class: "btn ghost", onClick: done }, "Annuler"));
    actions.appendChild(el("button", { class: "btn primary", onClick: save }, "Enregistrer"));
    modal.appendChild(actions);
  }

  modal.appendChild(el("div", { class: "loading" }, "Chargement"));
  document.body.appendChild(backdrop);
  reload().then(render).catch((e) => {
    console.error(e);
    clear(modal);
    modal.appendChild(el("p", { class: "muted" }, "Erreur de chargement de la banque."));
    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  });
}
