import {
  listStagiaires, listProfs,
  addStagiaire, updateStagiaire, deleteStagiaire,
  addProf, updateProf, deleteProf,
  getSetting, setSetting,
} from "../db.js";
import { el, clear, toast, sha256 } from "../utils.js";

async function renderSection(title, items, type, container) {
  const wrap = el("div", { class: "config-section" });
  wrap.appendChild(el("h3", {}, title));

  const list = el("ul", { class: "config-list" });
  items.forEach((it) => {
    const input = el("input", { type: "text", value: it.prenom || it.nom });
    input.addEventListener("blur", async () => {
      const v = input.value.trim();
      if (!v) return;
      try {
        if (type === "stagiaire") await updateStagiaire(it.id, v);
        else await updateProf(it.id, v);
        toast("Mis à jour", "success");
      } catch (e) { toast(e.message, "error"); }
    });
    const li = el("li", {},
      input,
      el("button", {
        class: "btn small danger",
        onClick: async () => {
          if (!confirm(`Supprimer ${it.prenom || it.nom} ?`)) return;
          try {
            if (type === "stagiaire") await deleteStagiaire(it.id);
            else await deleteProf(it.id);
            toast("Supprimé", "success");
            await rerender(container);
          } catch (e) { toast(e.message, "error"); }
        }
      }, "🗑")
    );
    list.appendChild(li);
  });
  wrap.appendChild(list);

  const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "Prénom du nouveau stagiaire" : "Nom du nouveau prof" });
  const addBtn = el("button", { class: "btn primary", style: "width:auto", onClick: async () => {
    const v = addInput.value.trim();
    if (!v) return;
    try {
      if (type === "stagiaire") await addStagiaire(v);
      else await addProf(v);
      addInput.value = "";
      toast("Ajouté", "success");
      await rerender(container);
    } catch (e) { toast(e.message, "error"); }
  }}, "➕ Ajouter");
  wrap.appendChild(el("div", { class: "config-add" }, addInput, addBtn));

  return wrap;
}

async function renderPasswordSection(container) {
  const wrap = el("div", { class: "config-section" });
  wrap.appendChild(el("h3", {}, "🔒 Mot de passe de la promo"));
  wrap.appendChild(el("p", { class: "muted", style: "margin-top:0" },
    "Mot de passe partagé. Toute personne ayant ce mot de passe peut accéder à l'app. À changer si compromis."
  ));

  const oldInput = el("input", { type: "password", placeholder: "Mot de passe actuel (ou laisser vide si jamais défini)" });
  const newInput = el("input", { type: "password", placeholder: "Nouveau mot de passe" });
  const confirmInput = el("input", { type: "password", placeholder: "Confirmer le nouveau mot de passe" });

  const submitBtn = el("button", { class: "btn primary", style: "width:auto", onClick: async () => {
    const currentHash = await getSetting("password_hash");
    if (currentHash) {
      const oldHash = await sha256(oldInput.value);
      if (oldHash !== currentHash) {
        toast("Mot de passe actuel incorrect", "error");
        return;
      }
    }
    if (!newInput.value || newInput.value.length < 4) {
      toast("Le nouveau mot de passe doit faire au moins 4 caractères", "error");
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
  }}, "Enregistrer");

  wrap.appendChild(el("div", { class: "modal-form" },
    el("div", { class: "field" }, el("label", {}, "Mot de passe actuel"), oldInput),
    el("div", { class: "field" }, el("label", {}, "Nouveau mot de passe"), newInput),
    el("div", { class: "field" }, el("label", {}, "Confirmer"), confirmInput),
    submitBtn
  ));

  return wrap;
}

async function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);

  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("h2", {}, "⚙️ Configuration"),
    el("p", { class: "subtitle" }, "Gérer la liste des stagiaires, profs, et le mot de passe d'accès.")
  ));

  container.appendChild(await renderSection("👥 Stagiaires", stagiaires, "stagiaire", container));
  container.appendChild(await renderSection("🎓 Formateurs (Profs)", profs, "prof", container));
  container.appendChild(await renderPasswordSection(container));
}

export async function renderConfig(container) {
  await rerender(container);
}
