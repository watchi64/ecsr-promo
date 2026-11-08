# -*- coding: utf-8 -*-
"""Une visite : une personne qui joue un parcours, et tout ce que le robot mesure en même temps.

Le parcours décrit des gestes (`aller`, `toucher`, `remplir`, `attendre`) ; la visite compte les clics,
chronomètre l'affichage, vérifie que chaque geste a un effet, contrôle chaque écran (défilement de côté,
noms des boutons, cibles, mots interdits, contraste, texte coupé) et note les constats selon le
référentiel (docs/qualite/referentiel.md). Un constat « bloque » arrête la fusion, un constat « liste » va
dans le lot de corrections suivant. Un geste impossible arrête le parcours (exception `Echec`).
"""
import re
import time

from playwright.sync_api import Error as ErreurPlaywright, TimeoutError as DelaiDepasse

from . import navigation

BLOQUE, LISTE = "bloque", "liste"

# Seuils du référentiel (§ 2), en millisecondes et en pixels.
OUVERTURE_MAX_MS = 3000
AFFICHAGE_MAX_MS = 1000
MESSAGE_MAX_MS = 2000
CIBLE_TELEPHONE, CIBLE_ORDINATEUR = 44, 24

CRITERES = {
    "A": "Le parcours aboutit", "B": "Budget de clics", "C": "Une page, un nom", "D": "Aucune impasse",
    "E": "Aucun refus silencieux", "F": "Libellés sans ambiguïté", "G": "Téléphone et ordinateur",
    "H": "Chromium et WebKit", "I": "Temps d'affichage", "J": "Robustesse", "K": "Finition visuelle",
}


class Echec(Exception):
    """Le parcours ne peut pas continuer (critère A) : la cible n'est pas là, ou le résultat n'arrive pas."""


# Contrôles d'un écran, joués dans la page. Rend des listes courtes et dédoublonnées.
JS_CONTROLES = r"""
(opts) => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  };
  const court = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const nomDe = (el) => {
    const aria = el.getAttribute('aria-label'); if (aria && aria.trim()) return aria.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim(); if (t) return t; }
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      if (el.type === 'submit' || el.type === 'button') return el.value || '';
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && l.innerText.trim()) return l.innerText.trim(); }
      const p = el.closest('label'); if (p && p.innerText.trim()) return p.innerText.trim();
      return el.getAttribute('placeholder') || el.getAttribute('title') || '';
    }
    const t = (el.innerText || '').trim(); if (t) return t;
    const img = el.querySelector('img[alt], svg[aria-label], [role=img][aria-label]');
    if (img) return (img.getAttribute('alt') || img.getAttribute('aria-label') || '').trim();
    return (el.getAttribute('title') || '').trim();
  };
  const decrire = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.tagName === 'INPUT') s += `[type=${el.type}]`;
    const classes = (n) => [...n.classList].filter((x) => !/^(active|is-|open)/.test(x)).slice(0, 2).join('.');
    const c = classes(el);
    if (c) s += '.' + c;
    const h = el.getAttribute('href'); if (h && h.startsWith('#')) s += `[href="${h}"]`;
    // Sans classe, l'élément se reconnaît par son parent (« button.p-daynav-btn > span »).
    const p = el.parentElement;
    if (!c && p && p.id !== 'view') s = p.tagName.toLowerCase() + (classes(p) ? '.' + classes(p) : '') + ' > ' + s;
    const t = el.closest('[id]'); if (t && t !== el && t.id && t.id !== 'view' && t.id !== 'app') s = `#${t.id} ${s}`;
    return s;
  };
  const dansMatrice = (el) => !!el.closest('.matrice-wrap');
  const res = { defilement: [], deborde: [], sansNom: [], petites: [], mots: [], coupes: [], contraste: [] };

  // 1. Défilement de côté : la page, puis tout conteneur qui défile en largeur (hors matrice des notes).
  if (document.documentElement.scrollWidth > vw + 1) res.defilement.push(`la page fait ${document.documentElement.scrollWidth} px pour ${vw}`);
  for (const el of document.querySelectorAll('body *')) {
    if (res.defilement.length > 8) break;
    if (el.scrollWidth <= el.clientWidth + 2 || !visible(el) || dansMatrice(el)) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox === 'auto' || ox === 'scroll') res.defilement.push(`${decrire(el)} défile (${el.scrollWidth} px pour ${el.clientWidth})`);
  }
  // 2. Ce qui sort de l'écran à droite. La page coupe ce qui dépasse (overflow-x: clip sur body) : rien ne défile,
  // mais le contenu est tronqué et inatteignable, c'est un défaut. Seule une coupe posée par un composant (un
  // conteneur sous body qui défile ou masque) est voulue, comme ce qui est fixé à l'écran.
  const voulu = (el) => { for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (n.id === 'app' || n.id === 'view') continue;
    const s = getComputedStyle(n); if (s.overflowX !== 'visible' || s.position === 'fixed') return true; } return false; };
  const signales = [];
  for (const el of document.querySelectorAll('body *')) {
    if (res.deborde.length > 5) break;
    if (signales.some((s) => s.contains(el)) || dansMatrice(el) || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2 && getComputedStyle(el).position !== 'fixed' && !voulu(el)) {
      signales.push(el);
      res.deborde.push(`${decrire(el)} « ${court(el.innerText)} » sort de l'écran (bord droit à ${Math.round(r.right)} px pour ${vw})`);
    }
  }
  // 3. Boutons et liens : un nom, une taille de cible.
  const interactifs = [...document.querySelectorAll('a[href], button, [role=button], [role=tab], input:not([type=hidden]):not([type=file]), select, textarea, summary')]
    .filter(visible).filter((el) => !el.closest('#banc-bandeau, .banc-bandeau, [aria-hidden=true]'));
  const vus = new Set();
  for (const el of interactifs) {
    const nom = court(nomDe(el));
    if (!nom) { const d = decrire(el); if (!vus.has('n' + d)) { vus.add('n' + d); res.sansNom.push(d); } continue; }
    const r = el.getBoundingClientRect();
    const enLigne = el.tagName === 'A' && el.parentElement && /^(P|LI|SPAN|SMALL|EM|STRONG|TD|DD)$/.test(el.parentElement.tagName)
      && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 3;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (!enLigne && type !== 'checkbox' && type !== 'radio' && Math.min(r.width, r.height) < opts.cible - 0.5) {
      const cle = 'p' + nom;
      if (!vus.has(cle)) { vus.add(cle); res.petites.push(`« ${nom} » ${Math.round(r.width)} x ${Math.round(r.height)} px`); }
    }
  }
  // 4. Mots qui n'ont rien à faire sous les yeux d'un utilisateur.
  const texte = (document.body.innerText || '').replace(/BANC D'ESSAI[^\n]*/g, '');
  const MOTS = [[/\bundefined\b/, 'undefined'], [/\bnull\b/, 'null'], [/\bNaN\b/, 'NaN'], [/Invalid Date/, 'Invalid Date'],
    [/\[object Object\]/, '[object Object]'], [/\bwhitelist\b/i, 'whitelist'], [/\bmdp\b/i, 'mdp'], [/\badmin\b/i, 'admin'],
    [/\bProfs?\b/, 'Prof'], [/(^|[\s(])[-−]\s?\d+\s*jours?\b/, 'compte à rebours négatif']];
  for (const [re, nom] of MOTS) { const m = texte.match(re); if (m) {
    const i = Math.max(0, m.index - 30); res.mots.push(`${nom} : « ${court(texte.slice(i, m.index + m[0].length + 30))} »`); } }
  // 5. Texte coupé par des points de suspension.
  for (const el of document.querySelectorAll('body *')) {
    if (res.coupes.length > 5) break;
    const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && visible(el)) res.coupes.push(`${decrire(el)} « ${court(el.innerText)} »`);
  }
  // 6. Contraste du texte (4,5:1, 3:1 pour le grand texte) : couleur et fond réels, fonds en image ignorés.
  const rgba = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const melange = (h, b) => [0, 1, 2].map((i) => h[i] * h[3] + b[i] * (1 - h[3])).concat(1);
  const fondDe = (el) => { const pile = [];
    for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor); if (c && c[3] > 0) { pile.push(c); if (c[3] >= 1) break; } }
    let f = [255, 255, 255, 1]; for (let i = pile.length - 1; i >= 0; i--) f = melange(pile[i], f); return f; };
  const deja = new Set();
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n2;
  while ((n2 = marcheur.nextNode()) && res.contraste.length < 6) {
    const t = n2.nodeValue.trim(); if (t.length < 2) continue;
    const el = n2.parentElement;
    if (!el || deja.has(el) || !visible(el) || el.closest('#banc-bandeau, .banc-bandeau, svg, :disabled, [aria-disabled=true]')) continue;
    deja.add(el);
    const s = getComputedStyle(el); const c = rgba(s.color); const f = fondDe(el); if (!c || !f) continue;
    const op = Number(s.opacity) || 1; const coul = melange([c[0], c[1], c[2], c[3] * op], f);
    const L1 = lum(coul), L2 = lum(f); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const taille = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700;
    const seuil = (taille >= 24 || (gras && taille >= 18.66)) ? 3 : 4.5;
    if (ratio < seuil - 0.01) res.contraste.push(`${decrire(el)} (« ${court(t).slice(0, 30)} ») ${ratio.toFixed(2)}:1 pour ${seuil}:1`);
  }
  return res;
}
"""

# Attend que la page se pose : plus aucune mutation du DOM depuis `calme` ms (ou `max` atteint). Rend le temps
# écoulé jusqu'à la dernière mutation, et le nombre de mutations vues depuis la pose de l'espion.
JS_POSER_ESPION = r"""
() => {
  if (window.__robotEspion) window.__robotEspion.disconnect();
  window.__robotMutations = 0; window.__robotDerniere = performance.now(); window.__robotDepart = performance.now();
  window.__robotEspion = new MutationObserver((l) => {
    const utiles = l.filter((m) => !(m.target.closest && m.target.closest('#banc-bandeau, .banc-bandeau')));
    if (utiles.length) { window.__robotMutations += utiles.length; window.__robotDerniere = performance.now(); }
  });
  window.__robotEspion.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
}
"""
JS_ATTENDRE_CALME = r"""
({ calme, max }) => new Promise((ok) => {
  const t0 = performance.now();
  const tour = () => {
    const maintenant = performance.now();
    if (maintenant - window.__robotDerniere >= calme || maintenant - t0 >= max) {
      ok({ mutations: window.__robotMutations, ecoule: Math.round(window.__robotDerniere - window.__robotDepart), plafond: maintenant - t0 >= max });
    } else setTimeout(tour, 40);
  };
  tour();
})
"""

MOTIF_MESSAGE = re.compile(r"(erreur|impossible|échec|echec|réessa|reessa|pas pu|n'a pas|n’a pas|hors ligne|connexion)", re.I)


class Visite:
    def __init__(self, page, sc, parcours, base_url, dossier, erreurs_console):
        self.page, self.sc, self.parcours, self.base_url, self.dossier = page, sc, parcours, base_url, dossier
        self.erreurs_console = erreurs_console
        self.navigation, self.format, self.moteur = sc["navigation"], sc["format"], sc["moteur"]
        self.telephone = self.format == "telephone"
        self.espace = "stagiaire" if parcours.role == "stagiaire" else "equipe"
        b = parcours.budget
        self.budget = b[self.format] if isinstance(b, dict) else b
        self.clics, self.clics_au_but, self.but_atteint = 0, None, False
        self.etape_courante = "ouverture"
        self.etapes, self.constats, self.captures = [], [], []
        self.temps = {}
        self.dernier_nom = ""
        self._vues_controlees = set()
        self._compteur_captures = 0

    # --- constats et preuves -------------------------------------------------------------------------
    def constat(self, critere, gravite, message, capture=False):
        c = {"critere": critere, "gravite": gravite, "message": message, "etape": self.etape_courante}
        if capture:
            c["capture"] = self.capturer("constat")
        self.constats.append(c)
        return c

    def capturer(self, motif):
        self._compteur_captures += 1
        nom = "%s_%s_%s_%s_%02d_%s.png" % (self.parcours.id, self.moteur, self.format, self.navigation, self._compteur_captures, motif)
        try:
            self.page.screenshot(path=str(self.dossier / nom), timeout=8000)
        except (ErreurPlaywright, DelaiDepasse):
            return None
        self.captures.append(nom)
        return nom

    def etape(self, nom):
        self.etape_courante = nom
        self.etapes.append(nom)

    def echec(self, message):
        """Arrête le parcours : le but n'est pas atteint (critère A, bloque), avec une capture et ce qui était cliquable."""
        raise Echec(message)

    # --- attente et mesure ---------------------------------------------------------------------------
    def _poser_espion(self):
        try:
            self.page.evaluate(JS_POSER_ESPION)
        except ErreurPlaywright:
            pass

    def _attendre_calme(self, calme=200, maximum=4000):
        try:
            return self.page.evaluate(JS_ATTENDRE_CALME, {"calme": calme, "max": maximum})
        except ErreurPlaywright:
            # La page a changé de document (rechargement) : on attend son chargement.
            self.page.wait_for_load_state("load")
            return {"mutations": 1, "ecoule": 0, "plafond": False}

    def ouvrir(self):
        """Ouvre l'app à froid sur le banc et attend la barre de navigation."""
        self.etape("ouverture de l'app")
        params = dict(navigation.PARAMS_COMMUNS)
        params["role"] = self.parcours.role
        if self.parcours.role != "fondateur":
            params["fondateur"] = "0"          # le cas des vrais comptes : ni aperçu ni droits du fondateur
        if self.navigation == "nouvelle":
            params["nav2"] = "1"
        params.update(self.parcours.banc)
        params["cb"] = "%d" % (time.time() * 1000)
        adresse = self.base_url + "_harness.html?" + "&".join("%s=%s" % kv for kv in params.items())
        t0 = time.perf_counter()
        for essai in (1, 2):
            try:
                self.page.goto(adresse, wait_until="load", timeout=20000)
                break
            except (DelaiDepasse, ErreurPlaywright):
                if essai == 2:
                    self.echec("le banc ne s'ouvre pas")
        try:
            self.page.locator(navigation.SELECTEUR_BARRE).first.wait_for(state="attached", timeout=10000)
        except DelaiDepasse:
            self.echec("l'app ne montre aucune barre de navigation après 10 s")
        self._poser_espion()
        self._attendre_calme(calme=250, maximum=5000)
        ms = round((time.perf_counter() - t0) * 1000)
        self.temps["ouverture"] = ms
        if ms > OUVERTURE_MAX_MS:
            self.constat("I", LISTE, "l'app met %.1f s à s'ouvrir (seuil 3 s)" % (ms / 1000))
        self.controler_ecran("ouverture")
        # Point de départ commun (navigation.DEPART : le Planning ; l'app rouvre sinon la dernière page, Mon suivi
        # au banc), posé par l'adresse et non par un clic : le budget se compte depuis là.
        self.etape("départ depuis le Planning")
        self._poser_espion()
        self.page.evaluate("(h) => { location.hash = h; }", navigation.DEPART)
        self._attendre_calme(calme=250, maximum=4000)
        self.controler_ecran("Planning")

    # --- gestes --------------------------------------------------------------------------------------
    def _resoudre(self, cible):
        if isinstance(cible, str):
            return self.page.locator(cible)
        return cible

    def _premier_visible(self, loc, quoi, delai=5000):
        try:
            loc.first.wait_for(state="attached", timeout=delai)
        except DelaiDepasse:
            self.echec("introuvable : %s" % quoi)
        fin = time.time() + delai / 1000
        while True:
            n = loc.count()
            for i in range(n):
                el = loc.nth(i)
                try:
                    if el.is_visible():
                        return el
                except ErreurPlaywright:
                    pass
            if time.time() > fin:
                self.echec("pas visible : %s" % quoi)
            self.page.wait_for_timeout(100)

    def toucher(self, cible, quoi, compte=True, attendu_effet=True):
        """Un clic (un toucher sur téléphone) sur ce que voit la personne. `cible` : un sélecteur CSS ou un Locator.
        Vérifie la taille de la cible et son nom, compte le clic, chronomètre l'affichage, et vérifie qu'il se passe quelque chose."""
        el = self._premier_visible(self._resoudre(cible), quoi)
        try:
            el.scroll_into_view_if_needed(timeout=3000)
        except (ErreurPlaywright, DelaiDepasse):
            pass
        # La taille de la cible est relevée par le contrôle de l'écran (tous les boutons visibles), pas ici.
        try:
            self.dernier_nom = el.evaluate("(e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').trim()")
        except ErreurPlaywright:
            self.dernier_nom = ""
        hash_avant = self.page.evaluate("location.hash")
        self._poser_espion()
        t0 = time.perf_counter()
        try:
            if self.telephone:
                el.tap(timeout=4000)
            else:
                el.click(timeout=4000)
        except (ErreurPlaywright, DelaiDepasse) as e:
            raison = str(e).strip().splitlines()
            recouvre = [l for l in raison if "intercepts pointer events" in l]
            self.echec("impossible de toucher %s%s" % (quoi, (" : " + recouvre[0].strip()[:160]) if recouvre else ""))
        if compte and not self.but_atteint:
            self.clics += 1
        calme = self._attendre_calme()
        ms = calme["ecoule"]
        self.temps.setdefault("gestes", []).append(ms)
        if calme["plafond"]:
            self.constat("I", LISTE, "l'écran bouge encore 4 s après « %s »" % quoi)
        elif ms > AFFICHAGE_MAX_MS:
            self.constat("I", LISTE, "« %s » : affiché en %.1f s (seuil 1 s)" % (quoi, ms / 1000))
        hash_apres = self.page.evaluate("location.hash")
        if attendu_effet and calme["mutations"] == 0 and hash_apres == hash_avant:
            # Rien n'a bougé : une personne toucherait une seconde fois. Si le second toucher marche, c'est noté
            # (liste) ; s'il ne marche pas non plus, le bouton ne fait rien (refus silencieux, bloque).
            self.page.wait_for_timeout(400)
            try:
                (el.tap if self.telephone else el.click)(timeout=4000)
            except (ErreurPlaywright, DelaiDepasse):
                pass
            calme = self._attendre_calme()
            if calme["mutations"] == 0 and self.page.evaluate("location.hash") == hash_avant:
                self.constat("E", BLOQUE, "toucher « %s » ne change rien à l'écran (deux essais)" % quoi, capture=True)
                # La personne est bloquée là : le parcours s'arrête (sinon une boucle de réponses tournerait à vide).
                self.echec("bloqué : « %s » ne répond pas" % quoi)
            else:
                self.constat("E", LISTE, "il a fallu toucher deux fois « %s »" % quoi)
        if not self.but_atteint and self.clics == self.budget + 1:
            # L'ancienne navigation est appelée à disparaître : son dépassement est listé, pas bloquant.
            self.constat("B", BLOQUE if self.navigation == "nouvelle" else LISTE,
                         "plus de %d clic%s avant le but (budget du référentiel)" % (self.budget, "s" if self.budget > 1 else ""))
        return el

    def remplir(self, cible, texte, quoi):
        el = self._premier_visible(self._resoudre(cible), quoi)
        el.fill(texte)
        return el

    def attendre(self, cible, quoi, delai=5000):
        """Le résultat attendu doit apparaître (sinon le parcours échoue)."""
        loc = self._resoudre(cible)
        try:
            loc.first.wait_for(state="visible", timeout=delai)
        except DelaiDepasse:
            # Le premier peut être caché alors qu'un autre est visible.
            return self._premier_visible(loc, quoi, delai=500)
        return loc.first

    def voit(self, cible):
        loc = self._resoudre(cible)
        try:
            return any(loc.nth(i).is_visible() for i in range(min(loc.count(), 20)))
        except ErreurPlaywright:
            return False

    def texte(self, cible):
        return self._premier_visible(self._resoudre(cible), str(cible)).inner_text()

    def but(self, quoi):
        """La tâche est faite : on arrête de compter les clics."""
        self.but_atteint = True
        self.clics_au_but = self.clics
        self.etape("but atteint : " + quoi)
        self.controler_ecran(quoi)

    def aller(self, destination):
        """Va vers une page par le chemin le plus court qu'offre la navigation (navigation.py), en cliquant."""
        self.etape("aller vers « %s »" % destination)
        chemin = navigation.chemin(destination, self.navigation, self.espace, self.telephone)
        for selecteur, quoi in chemin:
            self.toucher(selecteur, quoi)
        self.controler_ecran(destination)
        # Le nom de l'entrée et le titre de la page se comparent quand le dernier clic ouvre une page (un sous-onglet
        # garde le titre de sa page, une fenêtre n'en a pas).
        if destination not in navigation.FENETRES and navigation.ouvre_une_page(chemin[-1][0]):
            self.verifier_nom_de_page(self.dernier_nom)

    def verifier_nom_de_page(self, nom_entree):
        """Une page, un nom (critère C) : le titre de la page atteinte reprend le nom de l'entrée cliquée."""
        premiere_ligne = (nom_entree or "").strip().split("\n")[0]
        nom = re.sub(r"[\d+]+", "", premiere_ligne.split(",")[0]).strip()
        if not nom:
            return
        titre = self.page.evaluate(r"""() => { const t = [...document.querySelectorAll('#view h1, #view h2')]
          .find((h) => { const r = h.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
          return t ? t.innerText.replace(/\s+/g, ' ').trim() : ''; }""")
        a, b = nom.lower(), titre.lower()
        if not b or (a not in b and b not in a):
            self.constat("C", LISTE, "l'entrée « %s » ouvre une page titrée « %s »" % (nom, titre or "(sans titre)"))

    # --- pannes simulées (refus silencieux) ----------------------------------------------------------
    def panne(self, message="network error"):
        """Toute lecture ou écriture du faux Supabase échoue jusqu'à `retablir()`."""
        self.page.evaluate("(m) => { window.__HARNESS_FAIL = m; }", message)

    def retablir(self):
        self.page.evaluate("() => { window.__HARNESS_FAIL = null; }")

    def exiger_message(self, quoi, cible=None):
        """Après une action en échec, un message en français doit apparaître en moins de 2 s (critère E)."""
        fin = time.time() + MESSAGE_MAX_MS / 1000
        zone = self._resoudre(cible) if cible else self.page.locator("body")
        while time.time() < fin:
            # Un message d'alerte visible et non vide (role=alert, boîte d'erreur, message du bas), ou des mots d'échec.
            alerte = self.page.evaluate(r"""() => [...document.querySelectorAll(
                '[role=alert], [aria-live=assertive], #toast:not(.hidden), [class*=erreur], [class*=error]')]
              .some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.innerText || '').trim().length > 3; })""")
            if alerte:
                return True
            try:
                txt = zone.first.inner_text(timeout=500)
            except (ErreurPlaywright, DelaiDepasse):
                txt = ""
            if MOTIF_MESSAGE.search(txt or ""):
                return True
            self.page.wait_for_timeout(150)
        self.constat("E", BLOQUE, "%s : aucun message d'échec en 2 s" % quoi, capture=True)
        return False

    # --- sorties (impasses) --------------------------------------------------------------------------
    def fermer_par_echap(self, fenetre, quoi):
        """Sur ordinateur, Échap ferme une fenêtre ouverte (critère D)."""
        if self.telephone:
            return
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(300)
        if self.voit(fenetre):
            self.constat("D", BLOQUE, "Échap ne ferme pas %s" % quoi, capture=True)

    def verifier_precedent(self, hash_attendu, quoi):
        """« Précédent » du navigateur ramène à la page d'avant (critère D)."""
        self.etape("Précédent du navigateur")
        self._poser_espion()
        self.page.go_back(wait_until="commit")
        self._attendre_calme()
        h = self.page.evaluate("location.hash")
        if h != hash_attendu:
            self.constat("D", BLOQUE, "Précédent depuis %s mène à %s, pas à %s" % (quoi, h or "(rien)", hash_attendu), capture=True)

    def verifier_sortie(self):
        """À la fin du parcours, la barre de navigation est visible et rien ne la recouvre (critère D)."""
        ok = self.page.evaluate(r"""(sel) => {
          const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
          return els.some((e) => { const r = e.getBoundingClientRect();
            const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
            const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); });
        }""", navigation.SELECTEUR_LIENS)
        if not ok:
            self.constat("D", BLOQUE, "à la fin, aucune entrée de la barre n'est visible et libre (fenêtre restée ouverte ?)", capture=True)

    # --- contrôles d'écran ---------------------------------------------------------------------------
    def controler_ecran(self, nom):
        """Contrôles de l'écran affiché (une fois par écran et par visite)."""
        cle = (nom, self.page.evaluate("location.hash"))
        if cle in self._vues_controlees:
            return
        self._vues_controlees.add(cle)
        try:
            r = self.page.evaluate(JS_CONTROLES, {"cible": CIBLE_TELEPHONE if self.telephone else CIBLE_ORDINATEUR})
        except ErreurPlaywright as e:
            self.constat("J", LISTE, "contrôles de l'écran impossibles : %s" % str(e).splitlines()[0][:120])
            return
        for d in r["defilement"]:
            self.constat("G", BLOQUE, "défilement de côté : " + d, capture=not any(c.get("capture") for c in self.constats if c["critere"] == "G"))
        for i, d in enumerate(r["deborde"]):
            self.constat("G", BLOQUE, "déborde : " + d, capture=(i == 0))
        for d in r["sansNom"]:
            self.constat("F", LISTE, "bouton ou lien sans nom : " + d)
        for d in r["petites"]:
            self.constat("G", LISTE, "cible trop petite : " + d)
        for d in r["mots"]:
            self.constat("F", LISTE, "mot à proscrire : " + d)
        for d in r["coupes"]:
            self.constat("K", LISTE, "texte coupé : " + d)
        for d in r["contraste"]:
            self.constat("G", LISTE, "contraste insuffisant : " + d)

    def terminer(self):
        """Fin du parcours : capture pour la planche (attrait visuel), sortie visible, erreurs de la console."""
        self.etape("fin")
        self.capture_finale = self.capturer("fin")
        self.verifier_sortie()
