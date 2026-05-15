import {
  listStagiaires, listProfs,
  addStagiaire, updateStagiaire, deleteStagiaire,
  addProf, updateProf, deleteProf,
  getSetting, setSetting,
} from "../db.js";
import { el, clear, toast, sha256 } from "../utils.js";
import { icon } from "../icons.js";

async function renderListSection(title, items, type, container) {
  const section = el("section", { class: "config-section" });

  section.appendChild(el("div", { class: "config-section-head" },
    el("h3", {}, title),
    el("span", { class: "count" }, items.length + " entrée" + (items.length > 1 ? "s" : ""))
  ));

  const list = el("ul", { class: "config-list" });
  items.forEach((it) => {
    const input = el("input", { type: "text", value: it.prenom || it.nom });
    input.addEventListener("blur", async () => {
      const v = input.value.trim();
      if (!v || v === (it.prenom || it.nom)) return;
      try {
        if (type === "stagiaire") await updateStagiaire(it.id, v);
        else await updateProf(it.id, v);
        toast("Mis à jour", "success");
      } catch (e) { toast(e.message, "error"); }
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });

    const delBtn = el("button", { class: "btn small danger icon-only", "aria-label": "Supprimer" });
    delBtn.appendChild(icon.trash());
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer ${it.prenom || it.nom} ?`)) return;
      try {
        if (type === "stagiaire") await deleteStagiaire(it.id);
        else await deleteProf(it.id);
        toast("Supprimé", "success");
        await rerender(container);
      } catch (e) { toast(e.message, "error"); }
    });

    list.appendChild(el("li", {}, input, delBtn));
  });
  section.appendChild(list);

  const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "Prénom" : "Nom" });
  const addBtn = el("button", { class: "btn accent", onClick: async () => {
    const v = addInput.value.trim();
    if (!v) return;
    try {
      if (type === "stagiaire") await addStagiaire(v);
      else await addProf(v);
      addInput.value = "";
      toast("Ajouté", "success");
      await rerender(container);
    } catch (e) { toast(e.message, "error"); }
  }}, icon.plus(), "Ajouter");
  addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });

  section.appendChild(el("div", { class: "config-add" }, addInput, addBtn));

  return section;
}

async function renderPasswordSection() {
  const section = el("section", { class: "config-section" });

  section.appendChild(el("div", { class: "config-section-head" },
    el("h3", {}, "Mot de passe partagé")
  ));
  section.appendChild(el("p", { class: "muted", style: "margin:0 0 1rem;font-size:0.88rem" },
    "Toute personne qui dispose de ce mot de passe peut accéder à l'app. À renouveler si compromis."
  ));

  const oldInput = el("input", { type: "password", placeholder: "Actuel" });
  const newInput = el("input", { type: "password", placeholder: "Nouveau (min. 4 caractères)" });
  const confirmInput = el("input", { type: "password", placeholder: "Confirmer" });

  const submitBtn = el("button", { class: "btn primary", onClick: async () => {
    const currentHash = await getSetting("password_hash");
    if (currentHash) {
      const oldHash = await sha256(oldInput.value);
      if (oldHash !== currentHash) {
        toast("Mot de passe actuel incorrect", "error");
        return;
      }
    }
    if (!newInput.value || newInput.value.length < 4) {
      toast("Minimum 4 caractères", "error");
      return;
    }
    if (newInput.value !== confirmInput.value) {
      toast("Les mots de passe ne correspondent pas", "error");
      return;
    }
    const newHash = await sha256(newInput.value);
    await setSetting("password_hash", newHash);
    localStorage.setItem("ecsr_auth", newHash);
    toast("Mot de passe mis à jour", "success");
    oldInput.value = newInput.value = confirmInput.value = "";
  }}, icon.check(), "Mettre à jour");

  section.appendChild(el("div", { class: "modal-form" },
    el("div", { class: "field" }, el("label", {}, "Mot de passe actuel"), oldInput),
    el("div", { class: "field" }, el("label", {}, "Nouveau mot de passe"), newInput),
    el("div", { class: "field" }, el("label", {}, "Confirmer le nouveau mot de passe"), confirmInput),
    el("div", { style: "margin-top:0.25rem" }, submitBtn)
  ));

  return section;
}

async function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);

  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Réglages"),
      el("h2", {}, "Configuration"),
      el("p", { class: "subtitle" }, "Gérer la liste des stagiaires et formateurs, et le mot de passe d'accès partagé."),
    ),
  ));

  const grid = el("div", { class: "config-grid" });
  grid.appendChild(await renderListSection("Stagiaires", stagiaires, "stagiaire", container));
  grid.appendChild(await renderListSection("Formateurs", profs, "prof", container));
  grid.appendChild(await renderPasswordSection());
  container.appendChild(grid);
}

export async function renderConfig(container) {
  await rerender(container);
}
