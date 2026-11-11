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

from . import banc, navigation

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


class Fausse(Exception):
    """Un geste a été faussé par le clavier de la machine (Maj, Ctrl, Alt ou Windows tenue pendant le passage,
    voir banc.attendre_clavier_libre) : ce n'est pas le geste d'une personne, le passage ne dit rien de l'app. Il est
    rejoué entier (robot_parcours.jouer_un)."""


class NonJuge(Exception):
    """Le robot n'a pas de quoi juger ce contrôle (par exemple la liste des noms à chercher est trop courte parce que les fichiers du
    banc manquent) : le passage est « non jugé », ni vert ni rouge, et le résultat de la série ne peut pas être vert (INCOMPLET,
    code 2). Contrairement à Fausse, le rejouer n'y change rien : il n'est pas rejoué (robot_parcours.jouer_un)."""


# Contrôles d'un écran, joués dans la page. Rend des listes courtes et dédoublonnées.
JS_CONTROLES = r"""
(opts) => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  // affiche : rendu, où qu'il soit dans la page (défilement, débordement et texte coupé se contrôlent sur toute
  // la page) ; visible : affiché et dans la partie de l'écran que voit la personne.
  const affiche = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const visible = (el) => { if (!affiche(el)) return false; const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; };
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
    if (el.scrollWidth <= el.clientWidth + 2 || !affiche(el) || dansMatrice(el)) continue;
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
    if (signales.some((s) => s.contains(el)) || dansMatrice(el) || !affiche(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2 && getComputedStyle(el).position !== 'fixed' && !voulu(el)) {
      signales.push(el);
      res.deborde.push(`${decrire(el)} « ${court(el.innerText)} » sort de l'écran (bord droit à ${Math.round(r.right)} px pour ${vw})`);
    }
  }
  // 3. Boutons et liens : un nom, une taille de cible.
  const interactifs = [...document.querySelectorAll('a[href], button, [role=button], [role=tab], input:not([type=hidden]):not([type=file]), select, textarea, summary')]
    .filter(visible).filter((el) => !el.closest('[aria-hidden=true]'));
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
    if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && affiche(el)) res.coupes.push(`${decrire(el)} « ${court(el.innerText)} »`);
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
    if (!el || deja.has(el) || !visible(el) || el.closest('svg, :disabled, [aria-disabled=true]')) continue;
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
    window.__robotMutations += l.length; window.__robotDerniere = performance.now();
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

# Le journal des messages du bas (#toast) : l'app n'a qu'une place pour eux, un message en remplace un autre. Chaque
# texte affiché est noté avec son heure, à partir de l'appel (ce qui était déjà à l'écran n'y entre pas).
JS_ECOUTER_MESSAGES = r"""() => {
  window.__robotToasts = [];
  const n = document.getElementById('toast');
  if (!n || window.__robotToastObs) return;
  const noter = () => {
    const x = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (n.classList.contains('hidden') || !x) return;
    const d = window.__robotToasts;
    if (!d.length || d[d.length - 1].texte !== x) d.push({ t: Math.round(performance.now()), texte: x });
  };
  window.__robotToastObs = new MutationObserver(noter);
  window.__robotToastObs.observe(n, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}"""
REMPLACE_MS = 1500   # une confirmation remplacée plus tôt que cela n'a pas pu être lue

# Les messages visibles : alertes, puis lignes qui parlent d'échec dans la page (#view) et dans les fenêtres ouvertes.
JS_MESSAGES = r"""() => {
  const affiche = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const net = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const out = [];
  for (const e of document.querySelectorAll('[role=alert], [aria-live=assertive], #toast:not(.hidden), [class*=erreur], [class*=error]'))
    if (affiche(e) && net(e.innerText).length > 3) out.push('alerte : ' + net(e.innerText));
  const motif = /(erreur|impossible|échec|echec|réessa|reessa|pas pu|n'a pas|n’a pas|hors ligne|connexion|réseau)/i;
  for (const z of document.querySelectorAll('#view, [role=dialog], [aria-modal=true], .modal, [class*=modal]'))
    if (affiche(z)) for (const l of (z.innerText || '').split('\n')) if (motif.test(l)) out.push('texte : ' + net(l));
  return out;
}"""


class Visite:
    def __init__(self, page, sc, parcours, base_url, dossier, erreurs_console):
        self.page, self.sc, self.parcours, self.base_url, self.dossier = page, sc, parcours, base_url, dossier
        self.erreurs_console = erreurs_console
        self.erreurs_attendues = []     # morceaux de messages de console que le parcours provoque exprès (une panne jouée)
        self.navigation, self.format, self.moteur = sc["navigation"], sc["format"], sc["moteur"]
        self.telephone = self.format == "telephone"
        # L'espace où la personne se trouve (il change quand elle en choisit un autre : un parcours le réécrit alors).
        self.espace = {"stagiaire": "stagiaire", "direction": "direction", "siege": "siege"}.get(parcours.role, "equipe")
        b = parcours.budget
        self.budget = b[self.format] if isinstance(b, dict) else b
        self.clics, self.clics_au_but, self.but_atteint = 0, None, False
        self.etape_courante = "ouverture"
        self.etapes, self.constats, self.captures = [], [], []
        self.temps = {}
        self.dernier_nom = ""
        self._vues_controlees = set()
        self._compteur_captures = 0
        self.attente_clavier = 20     # secondes d'attente d'un clavier libre avant un toucher (0 : aucune)

    # --- constats et preuves -------------------------------------------------------------------------
    def constat(self, critere, gravite, message, capture=False):
        deja = next((c for c in self.constats if (c["critere"], c["gravite"], c["message"]) == (critere, gravite, message)), None)
        if deja:
            return deja
        c = {"critere": critere, "gravite": gravite, "message": message, "etape": self.etape_courante}
        if capture:
            c["capture"] = self.capturer("constat")
        self.constats.append(c)
        return c

    def capturer(self, motif):
        self._compteur_captures += 1
        # Le nom porte l'habillage seulement s'il n'est pas le défaut : sans cela, la capture ECF écraserait celle d'ECSR
        # (même worker, mêmes moteur, format et navigation) ; les noms du défaut restent ceux d'avant.
        skin = self.sc.get("habillage", "ecsr")
        nom = "%s_%s_%s_%s%s_%02d_%s.png" % (self.parcours.id, self.moteur, self.format, self.navigation,
                                             "" if skin == "ecsr" else "_" + skin, self._compteur_captures, motif)
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
    def _hash(self):
        """L'adresse de la page. Un geste qui recharge l'app (choix d'un espace, d'un centre, d'une promo) peut la détruire pendant la lecture :
        on attend alors le chargement et on relit."""
        for _ in range(3):
            try:
                return self.page.evaluate("location.hash")
            except ErreurPlaywright:
                self.page.wait_for_load_state("load")
        return self.page.evaluate("location.hash")

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
        # Direction et siège : le profil vient du compte (`banc={"compte": ...}`), le levier ?role= prend la valeur d'un formateur.
        params["role"] = "formateur" if self.parcours.role in ("direction", "siege") else self.parcours.role
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
        if getattr(self.parcours, "ouverture", None) == "porte":
            # Le parcours commence sur la porte de connexion (personne n'est encore entré) : pas de barre, pas de page de départ.
            try:
                self.page.locator("#gate-submit").wait_for(state="visible", timeout=10000)
            except DelaiDepasse:
                self.echec("la porte de connexion ne s'affiche pas après 10 s")
            self._poser_espion()
            self._attendre_calme(calme=250, maximum=5000)
            self.temps["ouverture"] = round((time.perf_counter() - t0) * 1000)
            self.etape("porte de connexion")
            self.controler_ecran("porte")
            return
        try:
            self.page.locator(navigation.SELECTEUR_BARRE).first.wait_for(state="attached", timeout=10000)
        except DelaiDepasse:
            self.echec("l'app ne montre aucune barre de navigation après 10 s")
        barre = time.perf_counter()
        self._poser_espion()
        calme = self._attendre_calme(calme=250, maximum=5000)
        ms = round((barre - t0) * 1000 + calme["ecoule"])
        self.temps["ouverture"] = ms
        if ms > OUVERTURE_MAX_MS:
            self.constat("I", LISTE, "l'app met %.1f s à s'ouvrir (seuil 3 s)" % (ms / 1000))
        self.controler_ecran("ouverture")
        # Point de départ (navigation.DEPART, le Planning, sauf si le parcours en fixe un autre ; l'app rouvre sinon
        # la dernière page, Mon suivi au banc), posé par l'adresse et non par un clic : le budget se compte depuis là.
        depart = self.parcours.depart or navigation.DEPART
        self.etape("départ depuis %s" % depart)
        self._poser_espion()
        self.page.evaluate("(h) => { location.hash = h; }", depart)
        self._attendre_calme(calme=250, maximum=4000)
        self.controler_ecran("départ " + depart)

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

    def toucher(self, cible, quoi, compte=True, attendu_effet=True, ecriture=False):
        """Un clic (un toucher sur téléphone) sur ce que voit la personne. `cible` : un sélecteur CSS ou un Locator.
        Compte le clic, chronomètre l'affichage, et vérifie qu'il se passe quelque chose. `ecriture` : le geste
        enregistre (envoyer, signer) ; sans effet visible, il n'est jamais rejoué (un second envoi doublerait).
        Un geste faussé par le clavier de la machine lève Fausse (voir _verifier_geste)."""
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
        hash_avant = self._hash()
        self._preparer_geste()
        self._poser_espion()
        t0 = time.perf_counter()
        try:
            if self.telephone:
                el.tap(timeout=4000)
            else:
                el.click(timeout=4000)
        except (ErreurPlaywright, DelaiDepasse) as e:
            self._verifier_geste(quoi)      # un geste faussé se rejoue, il n'accuse pas l'app
            raison = str(e).strip().splitlines()
            recouvre = [l for l in raison if "intercepts pointer events" in l]
            self.echec("impossible de toucher %s%s" % (quoi, (" : " + recouvre[0].strip()[:160]) if recouvre else ""))
        if compte and not self.but_atteint:
            self.clics += 1
        calme = self._attendre_calme()
        self._verifier_geste(quoi)
        ms = calme["ecoule"]
        self.temps.setdefault("gestes", []).append(ms)
        if calme["plafond"]:
            self.constat("I", LISTE, "l'écran bouge encore 4 s après « %s »" % quoi)
        elif ms > AFFICHAGE_MAX_MS:
            self.constat("I", LISTE, "« %s » : affiché en %.1f s (seuil 1 s)" % (quoi, ms / 1000))
        hash_apres = self._hash()
        if attendu_effet and calme["mutations"] == 0 and hash_apres == hash_avant:
            # Rien n'a bougé : on laisse 1 s à un effet tardif (machine chargée), puis une personne toucherait une
            # seconde fois. Si le second toucher marche, c'est noté (liste) ; sinon le bouton ne fait rien (bloque).
            self.page.wait_for_timeout(1000)
            if self.page.evaluate("window.__robotMutations || 0") > 0 or self._hash() != hash_avant:
                self.constat("I", LISTE, "« %s » : rien ne s'affiche pendant plus de 1 s" % quoi)
                return self._apres_toucher(el)
            if ecriture:
                self.constat("E", BLOQUE, "toucher « %s » ne change rien à l'écran" % quoi, capture=True)
                self.echec("bloqué : « %s » ne répond pas" % quoi)
            self._preparer_geste()
            try:
                (el.tap if self.telephone else el.click)(timeout=4000)
            except (ErreurPlaywright, DelaiDepasse):
                pass
            calme = self._attendre_calme()
            self._verifier_geste(quoi)
            if calme["mutations"] == 0 and self._hash() == hash_avant:
                self.constat("E", BLOQUE, "toucher « %s » ne change rien à l'écran (deux essais)" % quoi, capture=True)
                # La personne est bloquée là : le parcours s'arrête (sinon une boucle de réponses tournerait à vide).
                self.echec("bloqué : « %s » ne répond pas" % quoi)
            else:
                # Référentiel §2, critère E : aucun bouton qui ne fait rien. Un bouton qui ne répond qu'au second toucher
                # trompe la personne au premier : il bloque (audit du 10/11). Le parcours continue, la personne finit par passer.
                self.constat("E", BLOQUE, "il a fallu toucher deux fois « %s » : le premier toucher ne fait rien" % quoi, capture=True)
        return self._apres_toucher(el)

    @property
    def _toucher_expose(self):
        """Le toucher de WebKit sous Windows reprend les touches tenues sur la machine (voir banc.py) ; Chromium et le
        clic d'ordinateur ne sont pas touchés."""
        return self.telephone and self.moteur == "webkit"

    def _preparer_geste(self):
        """Avant un geste : pour un toucher exposé, attendre un clavier libre ; puis vider le journal des touches de la
        page. Encore tenues au bout de l'attente : on touche quand même, `_verifier_geste` dira si le geste a été
        faussé."""
        if self._toucher_expose and self.attente_clavier:
            banc.attendre_clavier_libre(self.attente_clavier)
        try:
            self.page.evaluate("() => { window.__robotModifs = []; }")
        except ErreurPlaywright:
            pass

    def _verifier_geste(self, quoi):
        """Après un geste : s'il a reçu une touche que le robot n'a pas demandée (il n'en demande jamais), il a été
        faussé par le clavier de la machine. Le passage est rejoué (Fausse), sans constat sur l'app : un bouton
        réellement sans effet reçoit un geste propre et reste bloquant. Si le journal est perdu (le geste a rechargé
        la page) ou vide alors qu'une touche est tenue à l'instant sur la machine, un toucher exposé est tenu pour
        faussé : mieux vaut rejouer que juger un geste douteux."""
        try:
            notes = self.page.evaluate("() => window.__robotModifs || []")
        except ErreurPlaywright:
            notes = []
        if not notes and self._toucher_expose:
            notes = ["machine : %s" % "+".join(t) for t in [banc.touches_tenues()] if t]
        if notes:
            raise Fausse("« %s » : le geste reçu portait %s (touche tenue sur le clavier de la machine)"
                         % (quoi, notes[0].split(" : ", 1)[-1]))

    def _apres_toucher(self, el):
        # Budget dépassé : bloque dans les deux navigations (référentiel, critère B). Les dépassements de l'ancienne
        # navigation déjà présents sur main sont dans connus.py.
        if not self.but_atteint and self.clics == self.budget + 1:
            self.constat("B", BLOQUE, "plus de %d clic%s avant le but (budget du référentiel)" % (self.budget, "s" if self.budget > 1 else ""))
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
        premiere_ligne = navigation.titre_attendu(self.espace, nom_entree or "").strip().split("\n")[0]
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

    def console_attendue(self, morceau, fois=1):
        """Le parcours provoque une panne : l'app écrit cet échec dans la console (au plus `fois` lignes), ce n'est pas un défaut (critère J)."""
        self.erreurs_attendues.append((morceau, fois))

    def retablir(self):
        self.page.evaluate("() => { window.__HARNESS_FAIL = null; }")

    def messages_visibles(self):
        """Les messages à l'écran : alertes visibles (role=alert, boîte d'erreur, message du bas) et lignes de la page
        ou de la fenêtre ouverte qui parlent d'échec. À relever AVANT l'action en panne : `exiger_message` ne compte
        que les messages nouveaux (un « Connexion requise » déjà affiché ne dit rien de la panne)."""
        try:
            return {t for t in self.page.evaluate(JS_MESSAGES) if t}
        except ErreurPlaywright:
            return set()

    def exiger_message(self, quoi, avant, critere="E", gravite=BLOQUE):
        """Après une action en échec, un message nouveau doit apparaître en moins de 2 s. Critère E (bloque) pour une
        action refusée ; une lecture en panne relève du critère J (listé), voir le référentiel."""
        fin = time.time() + MESSAGE_MAX_MS / 1000
        while time.time() < fin:
            if self.messages_visibles() - avant:
                return True
            self.page.wait_for_timeout(150)
        self.constat(critere, gravite, "%s : aucun message d'échec en 2 s" % quoi, capture=True)
        return False

    # --- confirmation d'un geste (message du bas) ----------------------------------------------------
    def ecouter_messages(self):
        """À poser juste avant le geste à confirmer : le journal des messages du bas repart de zéro."""
        self.page.evaluate(JS_ECOUTER_MESSAGES)

    def _journal(self):
        try:
            return self.page.evaluate("() => window.__robotToasts || []")
        except ErreurPlaywright:
            return []

    def exiger_confirmation(self, quoi, contient, delai=4000):
        """Après le geste, un message du bas qui contient `contient` doit paraître (critère E, bloque). Il ne suffit
        pas de lire le message à l'écran : un autre (une annonce de démarrage) peut l'avoir remplacé. On lit le
        journal ; une confirmation remplacée en moins de 1,5 s est notée (critère E, listé)."""
        cle = contient.lower()
        fin = time.time() + delai / 1000
        journal = self._journal()
        while not any(cle in m["texte"].lower() for m in journal):
            if time.time() > fin:
                vus = " / ".join("« %s »" % m["texte"][:70] for m in journal) or "aucun"
                self.constat("E", BLOQUE, "après %s, aucun message ne confirme (messages vus : %s)" % (quoi, vus), capture=True)
                return False
            self.page.wait_for_timeout(150)
            journal = self._journal()
        i = next(k for k, m in enumerate(journal) if cle in m["texte"].lower())
        self.page.wait_for_timeout(REMPLACE_MS + 100)
        journal = self._journal()
        apres = [m for m in journal[i + 1:] if cle not in m["texte"].lower() and m["t"] - journal[i]["t"] < REMPLACE_MS]
        if apres:
            self.constat("E", LISTE, "la confirmation de %s est remplacée en moins de 1,5 s par un autre message (« %s »)"
                         % (quoi, apres[0]["texte"][:70]), capture=True)
        return True

    # --- sorties (impasses) --------------------------------------------------------------------------
    def fermer_par_echap(self, fenetre, quoi):
        """Sur ordinateur, Échap ferme une fenêtre ouverte (critère D)."""
        if self.telephone:
            return
        self.page.keyboard.press("Escape")
        try:
            self._resoudre(fenetre).first.wait_for(state="hidden", timeout=1000)
        except (ErreurPlaywright, DelaiDepasse):
            pass
        if self.voit(fenetre):
            self.constat("D", BLOQUE, "Échap ne ferme pas %s" % quoi, capture=True)

    def verifier_precedent(self, hash_attendu, quoi):
        """« Précédent » du navigateur ramène à la page d'avant (critère D)."""
        self.etape("Précédent du navigateur")
        self._poser_espion()
        self.page.go_back(wait_until="commit")
        self._attendre_calme()
        h = self._hash()
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
        cle = (nom, self._hash())
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
        # Une panne jouée exprès fait écrire l'échec dans la console par l'app : ces lignes-là, déclarées par le parcours, ne comptent pas.
        # Chaque déclaration couvre au plus `fois` lignes : une erreur de même texte venant d'ailleurs (au chargement) reste un défaut.
        restant = [[m, n] for m, n in self.erreurs_attendues]
        gardees = []
        for e in self.erreurs_console:
            cas = next((r for r in restant if r[1] > 0 and r[0] in e), None)
            if cas:
                cas[1] -= 1
            else:
                gardees.append(e)
        self.erreurs_console[:] = gardees
        self.capture_finale = self.capturer("fin")
        if getattr(self.parcours, "ouverture", None) != "porte":      # la porte de connexion n'a pas de barre de navigation
            self.verifier_sortie()
