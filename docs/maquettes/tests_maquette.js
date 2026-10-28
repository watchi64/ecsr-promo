// Tests de la maquette de navigation, joués dans la page (navigateur intégré) :
//   const r = await (await fetch("tests_maquette.js?" + Date.now())).text(); eval(r);
// Synchrone de bout en bout : fonctionne même quand l'onglet est en arrière-plan
// (pas d'attente d'image, la mise en page est recalculée à chaque mesure).
(function () {
  const M = window.__maquette, S = M.S;
  const screenEl = document.getElementById("screen"), frameEl = document.getElementById("frame");
  const rapport = { vues: 0, echecs: [], tailles: {}, entrees: {}, clics: {}, contrastes: [] };
  const echec = (type, detail) => rapport.echecs.push(type + " : " + detail);
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const dans = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;

  function taille(nom) {
    // ordinateur : cadre libre ; ordinateur étroit : 1100 px (barre latérale dépliée, contenu
    // le plus serré) ; tablette : 900 px ; téléphone : cadre iPhone
    frameEl.style.width = nom === "tablette" ? "900px" : nom === "ordinateur-etroit" ? "1100px" : "";
    S.device = nom === "telephone" ? "phone" : "desktop";
    M.render(); window.dispatchEvent(new Event("resize"));
    rapport.tailles[nom] = S.size + ", " + Math.round(screenEl.getBoundingClientRect().width) + " px";
  }

  function controlerVue(nom, role, page, sous) {
    rapport.vues++;
    const ou = `${nom}/${role}/${page}${sous ? "/" + sous : ""}`;
    const sc = document.getElementById("scroller");
    const h1 = sc && sc.querySelector("h1");
    if (!h1) echec("page sans titre", ou);
    if (sc && sc.scrollWidth > sc.clientWidth + 1) echec("défilement horizontal", ou + " " + sc.scrollWidth + ">" + sc.clientWidth);
    const b = sc.getBoundingClientRect();
    const larges = new Set();
    // Pas de défilement de côté (retour de Timy du 27/10 : « à éviter absolument » sur téléphone),
    // avec une seule exception admise par lui : la matrice des notes, marquée `.defile-autorise`.
    sc.querySelectorAll("*").forEach((el) => {
      if (el.closest(".defile-autorise")) return;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > b.right + 1 || r.left < b.left - 1) && !el.closest(".sr")) larges.add(String(el.getAttribute("class") || el.tagName).slice(0, 30));
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) larges.add("défile de côté : " + String(el.getAttribute("class") || el.tagName).slice(0, 30));
    });
    if (larges.size) echec("élément trop large", ou + " " + [...larges].slice(0, 3).join(", "));
    // l'exception reste une exception : seule la matrice de la page Notes peut défiler
    if (sc.querySelector(".defile-autorise") && page !== "notes") echec("défilement autorisé hors de la matrice", ou);
    // le cadre de navigation reste entièrement dans l'écran
    const ecran = screenEl.getBoundingClientRect();
    document.querySelectorAll(".side-foot, .side-head, .bbar, .lt-top, .mtop").forEach((el) => {
      if (visible(el) && !dans(el.getBoundingClientRect(), ecran)) echec("barre hors de l'écran", ou + " " + el.className);
    });
    // une seule entrée allumée dans la navigation visible
    const allumees = [...document.querySelectorAll(".lt-tabs [aria-current=page], .bbar [aria-current=page], .side-nav [aria-current=page]")].filter(visible);
    if (allumees.length !== 1) echec("entrée allumée", ou + " : " + allumees.length);
    // zones à toucher
    const min = nom === "telephone" ? 44 : 24;
    document.querySelectorAll("#app button, #app [data-act]").forEach((el) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.height < min - 0.5 || r.width < min - 0.5) echec("zone à toucher", ou + " " + Math.round(r.width) + "x" + Math.round(r.height) + " " + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30));
    });
    // libellés de la barre du bas : sur une ligne, jamais coupés
    document.querySelectorAll(".bbar .bb-item > span:last-child").forEach((sp) => {
      if (!visible(sp)) return;
      const h = sp.getBoundingClientRect().height, lh = parseFloat(getComputedStyle(sp).lineHeight) || 16;
      if (sp.scrollWidth > sp.clientWidth + 1 || h > lh * 1.5) echec("libellé de barre coupé", ou + " " + sp.textContent);
    });
    // tout ce qui agit est atteignable au clavier
    document.querySelectorAll("#app [data-go], #app [data-act], #app [data-open]").forEach((el) => {
      if (el.tagName !== "BUTTON" && el.getAttribute("tabindex") !== "0") echec("hors clavier", ou + " " + el.tagName);
    });
  }

  for (const nom of ["ordinateur", "ordinateur-etroit", "tablette", "telephone"]) {
    taille(nom);
    for (const role of Object.keys(M.ROLES)) {
      S.role = role; S.page = {}; S.sub = {}; M.render(); window.dispatchEvent(new Event("resize"));
      const R = M.ROLES[role];
      rapport.entrees[nom + "/" + role] = [...document.querySelectorAll(".lt-tabs .lt-tab, .bbar .bb-item, .side-nav .side-item")].filter(visible).length;
      for (const n of R.nav) {
        M.go(n.id);
        // clics depuis l'accueil de l'espace : 1 si l'entrée est dans la barre visible, 2 si elle passe par « Plus »
        const direct = [...document.querySelectorAll(`.lt-tabs [data-go="${n.id}"], .bbar [data-go="${n.id}"], .side-nav [data-go="${n.id}"]`)].some(visible);
        rapport.clics[`${nom}/${role}/${n.id}`] = direct ? 1 : 2;
        const sous = [...document.querySelectorAll("#scroller .subnav [data-sub]")].map((x) => x.dataset.sub);
        for (const k of (sous.length ? sous : [null])) {
          if (k) document.querySelector(`#scroller .subnav [data-sub="${k}"]`).click();
          controlerVue(nom, role, n.id, k);
          // fiches ouvertes depuis la page (stagiaire, centre) : chacune de leurs parties
          const ouvrir = document.querySelector("#scroller [data-act^='fiche:'], #scroller [data-act^='centre:']");
          if (ouvrir && (!k || k === sous[0])) {
            const act = ouvrir.dataset.act;
            ouvrir.click();
            const parts = [...document.querySelectorAll("#scroller .subnav [data-sub]")].map((x) => x.dataset.sub);
            for (const pf of (parts.length ? parts : [null])) {
              if (pf) document.querySelector(`#scroller .subnav [data-sub="${pf}"]`).click();
              controlerVue(nom, role, n.id, act + (pf ? "/" + pf : ""));
            }
            M.go(n.id);
          }
          // variantes d'affichage d'une même page (planning en grille ou en liste)
          for (const v of [...document.querySelectorAll("#scroller [data-act^='vue:']")].map((x) => x.dataset.act)) {
            document.querySelector(`#scroller [data-act="${v}"]`).click();
            controlerVue(nom, role, n.id, (k || "") + "/" + v);
          }
        }
      }
      // calques : dans l'écran, et la touche Échap les ferme
      for (const calque of ["account", "ctx", "menu", "signal", "assistant"]) {
        if (calque === "ctx" && R.layout === "tabs") continue;
        if (calque === "menu" && (R.layout === "tabs" || nom !== "telephone")) continue;
        M.open(calque);
        const pop = document.querySelector("#ovl .pop");
        if (!pop || !dans(pop.getBoundingClientRect(), screenEl.getBoundingClientRect())) echec("calque hors écran", `${nom}/${role}/${calque}`);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        if (document.querySelector("#ovl .pop")) { echec("Échap ne ferme pas", `${nom}/${role}/${calque}`); M.close(); }
      }
    }
  }
  frameEl.style.width = "";

  // contrastes des couleurs de texte, dans les deux habillages
  const lum = (hex) => { const c = hex.replace("#", ""); const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255).map((x) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const paires = [["--ink", "--bg"], ["--ink-soft", "--surface"], ["--ink-muted", "--bg"], ["--ink-muted", "--surface"], ["--ink-muted", "--sunken"], ["--accent-ink", "--surface"], ["--accent-ink", "--accent-soft"], ["--accent-ink", "--accent-soft-2"], ["--on-btn", "--btn"], ["--on-deep", "--deep"], ["--on-deep-muted", "--deep"], ["--on-badge", "--badge"], ["--ok", "--ok-soft"], ["--warn", "--warn-soft"], ["--signal", "--signal-soft"], ["--n1-ink", "--n1"], ["--n2-ink", "--n2"], ["--n3-ink", "--n3"], ["--n4-ink", "--n4"], ["--act-salle-ink", "--act-salle"], ["--act-voiture-ink", "--act-voiture"], ["--act-autonomie-ink", "--act-autonomie"], ["--act-examen-ink", "--act-examen"]];
  const avant = screenEl.dataset.skin;
  for (const habillage of ["ecsr", "ecf"]) {
    screenEl.dataset.skin = habillage;
    const cs = getComputedStyle(screenEl);
    let pire = 99, paire = "";
    for (const [f, b] of paires) { const r = ratio(cs.getPropertyValue(f).trim(), cs.getPropertyValue(b).trim()); if (r < pire) { pire = r; paire = f + " sur " + b; } if (r < 4.5) echec("contraste", `${habillage} ${f} sur ${b} = ${r.toFixed(2)}`); }
    rapport.contrastes.push(`${habillage} : le plus faible ${pire.toFixed(2)} (${paire})`);
  }
  screenEl.dataset.skin = avant;
  S.role = "stagiaire"; S.page = {}; S.device = "desktop"; M.render(); window.dispatchEvent(new Event("resize"));
  const c = Object.values(rapport.clics);
  rapport.resume = `${rapport.vues} vues, ${rapport.echecs.length} échec(s) ; destinations : ${c.filter((x) => x === 1).length} à 1 clic, ${c.filter((x) => x === 2).length} à 2 clics, 0 au-delà`;
  window.__rapport = rapport;
})();
JSON.stringify({ resume: window.__rapport.resume, echecs: window.__rapport.echecs.slice(0, 40), tailles: window.__rapport.tailles, entrees: window.__rapport.entrees, contrastes: window.__rapport.contrastes });
