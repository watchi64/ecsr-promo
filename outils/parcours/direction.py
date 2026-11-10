# -*- coding: utf-8 -*-
"""Parcours de la direction d'un centre (lot 5, Task 16) : P1 à P3, P9 et P10 (la part de la direction).

Le compte est choisi par le banc (`banc={"compte": ...}`, voir _harness_supabase.js) : `direction` (centre de Nîmes, et le centre de
démonstration avec `centre=1`), `direction-vide` (un centre sans promo), `dirform` (direction et formateur), `dirailleurs` (direction du
centre de Nîmes, formatrice à Montpellier). Les parcours jouent la nouvelle navigation : la direction n'existe que là ; P3 joue aussi
l'ancienne, pour la promo dont l'interrupteur est éteint. La page de départ est Promos : l'accueil de la direction (« Vue d'ensemble »)
est à 1 clic.

Les attendus viennent de l'écran livré (js/views/direction-*.js, js/espaces-rules.js) : le parcours vérifie ce qui existe.
"""
import re

from . import banc, parcours
from .navigation import SELECTEUR_BARRE, texte
from .visite import BLOQUE, LISTE, NonJuge

NOUVELLE = ("nouvelle",)
DEPART = "#/promos"

# Le titre que chaque page de la direction porte, dans l'ordre de la barre (puis « Plus » sur téléphone).
PAGES_DIRECTION = [("Promos", "Promos"), ("Stagiaires", "Stagiaires"), ("Émargement", "Émargement"),
                   ("Notes et examens", "Notes et examens"), ("Équipe", "Équipe"), ("Réglages du centre", "Réglages du centre")]


def titre(nom):
    """Le titre d'une page de l'espace : un titre visible de la page affichée."""
    return '#view :is(h1, h2):visible:has-text("%s")' % nom


def attendre_page(v, nom, quoi=None):
    """La page de ce titre est affichée (et le robot attend qu'elle ait fini de se dessiner)."""
    return v.attendre(titre(nom), quoi or "la page « %s »" % nom)


def verifier_adresse(v, hash_attendu, quoi):
    """Après un geste qui recharge l'app, l'adresse visée est celle de la page ouverte (critère D)."""
    h = v._hash()
    if not h.startswith(hash_attendu):
        v.constat("D", BLOQUE, "après %s, l'adresse est %s et non %s" % (quoi, h or "(vide)", hash_attendu), capture=True)


_PAIRES_DE_NOMS = None
_NB_PAIRES_LUES = 0
# Le banc porte 21 stagiaires fictifs nommés (11 dans _harness_supabase.js, 10 dans _banc_centre_demo.js). En dessous de ce nombre lu
# dans ses fichiers, la liste des noms à chercher est tronquée (un fichier absent ou un motif qui ne trouve plus rien) et le contrôle
# passerait « à vide » : il est alors NON JUGÉ (INCOMPLET), jamais vert.
MIN_PAIRES_LUES = 15
PRENOMS_PROMO_2 = ["Léa", "Hugo", "Inès", "Nolan", "Maëlle"]     # les stagiaires de la promo 2 (?emargement2=1)


def paires_de_noms():
    """(prénom, nom) des stagiaires fictifs du banc, lus dans ses fichiers. Ne servent qu'à chercher ces écritures dans une page : elles ne
    sont jamais écrites dans un message ni dans un rapport."""
    global _PAIRES_DE_NOMS, _NB_PAIRES_LUES
    if _PAIRES_DE_NOMS is None:
        paires = []
        for fichier, motif in (("_harness_supabase.js", r'prenom:\s*"([^"]+)",\s*nom:\s*"([^"]+)"'),
                               ("_banc_centre_demo.js", r'"prenom":\s*"([^"]+)",\s*"nom":\s*"([^"]+)"')):
            chemin = banc.RACINE / fichier
            if chemin.exists():
                paires += re.findall(motif, chemin.read_text(encoding="utf-8"))
        _NB_PAIRES_LUES = len(paires)
        # Les cinq stagiaires de la promo 2 sont construits par une boucle : prénoms et initiales d'après son code.
        paires += [(p, chr(67 + i) + ".") for i, p in enumerate(PRENOMS_PROMO_2)]
        _PAIRES_DE_NOMS = paires
    return _PAIRES_DE_NOMS


def exiger_assez_de_noms(nb_lues, quoi):
    """Lève NonJuge quand la liste des noms lue dans les fichiers du banc est trop courte pour que « aucun nom » veuille dire quelque chose."""
    if nb_lues < MIN_PAIRES_LUES:
        raise NonJuge("la liste des noms à chercher est trop courte (%d lus dans les fichiers du banc, au moins %d attendus) : « %s » ne peut pas être jugé"
                      % (nb_lues, MIN_PAIRES_LUES, quoi))


def aucun_nom_de_stagiaire(v, quoi, prenoms=None):
    """Aucun nom de stagiaire du banc dans la page (ou, avec `prenoms`, aucun de ceux-là : les stagiaires d'une autre promo)."""
    formes = set()
    paires = paires_de_noms()
    exiger_assez_de_noms(_NB_PAIRES_LUES, quoi)
    for prenom, nom in paires:
        if prenoms is None or prenom in prenoms:
            initiale = nom[0]
            formes |= {"%s %s" % (prenom, nom), "%s %s." % (prenom, initiale), "%s. %s" % (initiale, prenom)}
    texte_page = v.page.evaluate("() => document.body.innerText")
    trouves = [f for f in sorted(formes) if re.search(r"(?<![\wÀ-ÿ])" + re.escape(f) + r"(?![\wÀ-ÿ])", texte_page)]
    if trouves:
        v.constat("E", BLOQUE, "%s montre %d nom(s) de stagiaire du banc" % (quoi, len(trouves)), capture=True)


def changer_de_centre(v, nom):
    """Choisir un autre centre dans la pastille de la barre : l'app se recharge sur la même page."""
    adresse = v._hash()
    v.etape("choisir le centre « %s »" % nom)
    v.toucher("button.promo-pastille", "la pastille du centre", compte=False)
    v.toucher(texte(nom, "button.promo-choix"), "« %s » dans le choix du centre" % nom, compte=False,
               attendu_effet=False)     # le choix recharge l'app : rien ne bouge avant, un second toucher défairait le choix
    v.page.wait_for_function("(n) => (document.querySelector('.nav-contexte') || {}).title === 'Centre affiché : ' + n", arg=nom, timeout=10000)
    v._attendre_calme(calme=300, maximum=5000)
    verifier_adresse(v, adresse, "le choix du centre « %s »" % nom)


@parcours("direction-tour-du-centre", "P1 · La direction fait le tour de son centre et de ses gestes", role="direction", budget=1,
          banc={"compte": "direction", "centre": "1", "demo": "1", "emargement2": "1"}, navigations=NOUVELLE, depart=DEPART)
def tour_du_centre(v):
    """Vue d'ensemble en 1 clic, chaque entrée de la barre (puis de « Plus »), créer une promo, la fiche d'une autre promo, « Voir les
    feuilles », inviter un formateur : chaque geste aboutit ou dit pourquoi, et la page visée s'ouvre après chaque bascule."""
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.attendre("#view .centre-carte", "les cartes du centre")
    v.but("vue d'ensemble du centre")

    # Le centre de Nîmes : deux promos, la promo 1 affichée, l'émargement allumé (le centre de démonstration n'a pas l'entrée Émargement).
    changer_de_centre(v, "Nîmes")
    v.etape("chaque entrée de la barre")
    for entree, page in PAGES_DIRECTION:
        v.aller(entree)
        attendre_page(v, page)
    v.aller("Promos")
    attendre_page(v, "Promos")
    v.attendre("#view .promo-carte[data-promo=\"2\"]", "la carte de la promo de septembre")

    v.etape("créer une promo")
    v.toucher(texte("Créer une promo", "#view button"), "« Créer une promo »", compte=False)
    v.remplir("#promo-nom", "Promo de novembre 2026", "le nom de la promo")
    v.remplir("#promo-debut", "2026-11-16", "le début de la promo")
    v.ecouter_messages()
    v.toucher(texte("Créer la promo", ".modal button"), "« Créer la promo »", compte=False, ecriture=True)
    v.exiger_confirmation("la création de la promo", "Promo créée")
    v.attendre('#view .promo-carte:has-text("Promo de novembre 2026")', "la carte de la nouvelle promo")

    v.etape("gérer les stagiaires de la promo affichée")
    v.aller("Stagiaires")
    attendre_page(v, "Stagiaires")
    gerer = '#view .stg-groupe[data-promo="1"] .stg-gerer'
    v.toucher(gerer, "« Gérer »", compte=False)
    v.attendre('#view .stg-groupe[data-promo="1"] .stg-gestion', "la gestion à la place de la liste", delai=10000)
    if v.page.locator('#view .stg-groupe[data-promo="1"] .stg-liste').count():
        v.echec("la liste reste affichée sous la gestion")
    v.toucher(gerer, "« Fermer »", compte=False)
    v.attendre('#view .stg-groupe[data-promo="1"] .stg-liste', "la liste revenue")

    v.etape("la fiche d'une personne d'une autre promo")
    ligne = '#view .stg-groupe[data-promo="2"] a.stg-ligne'
    v.toucher(ligne, "un stagiaire de la promo de septembre", compte=False, attendu_effet=False)     # bascule de promo : l'app se recharge
    v.page.wait_for_function("() => /^#\\/stagiaires\\/\\d+/.test(location.hash)", timeout=10000)
    v.attendre("#view .stg-fiche", "la fiche de la personne", delai=15000)
    verifier_adresse(v, "#/stagiaires/", "l'ouverture de la fiche d'une autre promo")

    v.etape("« Voir les feuilles » d'une autre promo")
    v.aller("Émargement")
    attendre_page(v, "Émargement")
    v.toucher(texte("Voir les feuilles", "#view button"), "« Voir les feuilles »", compte=False, attendu_effet=False)     # bascule de promo
    v.page.wait_for_function("() => location.hash === '#/emargement'", timeout=10000)
    v.attendre('#view h3:has-text("Feuilles de Nîmes, mars 2026")', "les feuilles de la promo de mars", delai=15000)

    v.etape("inviter un formateur")
    v.aller("Équipe")
    attendre_page(v, "Équipe")
    v.toucher(texte("Inviter un formateur", "#view button"), "« Inviter un formateur »", compte=False)
    v.remplir("#equipe-email", "nouveau.formateur@exemple.invalid", "l'adresse du formateur")
    v.toucher("#equipe-promo-1", "la case de la promo de mars", compte=False, attendu_effet=False)
    v.ecouter_messages()
    v.toucher(texte("Inviter", ".modal button[type=submit]"), "« Inviter »", compte=False, ecriture=True)
    v.exiger_confirmation("l'invitation du formateur", "Compte créé")
    v.attendre('#view :is(tr, li, .liste-ligne):has-text("nouveau.formateur@exemple.invalid")', "la nouvelle personne dans la liste")
    v.terminer()


@parcours("direction-sans-promo", "P2 · Une direction sans promo crée la première promo de son centre", role="direction", budget=1,
          banc={"compte": "direction-vide"}, navigations=NOUVELLE, depart=DEPART)
def sans_promo(v):
    """Un centre sans promo : l'accueil dit « pas encore de promo » et mène à la création ; la première promo créée ouvre le centre."""
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.attendre('#view :has-text("pas encore de promo")', "« Ce centre n'a pas encore de promo »")
    v.but("accueil du centre sans promo")
    v.etape("créer la première promo")
    v.aller("Promos")
    attendre_page(v, "Promos")
    v.toucher(texte("Créer une promo", "#view button"), "« Créer une promo »", compte=False)
    v.remplir("#promo-nom", "Première promo", "le nom de la promo")
    v.remplir("#promo-debut", "2026-11-16", "le début de la promo")
    v.toucher(texte("Créer la promo", ".modal button"), "« Créer la promo »", compte=False, ecriture=True)
    v.attendre('#view .promo-carte:has-text("Première promo")', "la carte de la première promo")
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    if v.voit('#view :has-text("pas encore de promo")'):
        v.constat("D", BLOQUE, "le centre dit encore « pas encore de promo » après la création de la première promo", capture=True)
    v.terminer()


# --- Les espaces d'un compte (P3, P5) ------------------------------------------------------------------------------------------------

ESPACE_DE_LA_BARRE = {"direction": "Direction", "equipe": "Formateur", "siege": "Siège", "stagiaire": "Stagiaire"}


def ouvrir_le_menu_du_compte(v, compter=False):
    """Le bouton du compte : celui de l'ancienne barre (formateur et stagiaire sans la refonte), sinon celui de la nouvelle."""
    ancienne = v.navigation == "ancienne" and v.espace in ("equipe", "stagiaire")
    v.toucher("button.admin-badge" if ancienne else 'button[data-nav-action="compte"]', "le bouton du compte", compte=compter)


def verifier_la_barre(v, espace):
    """La barre affichée est celle de cet espace (direction, siège : la nouvelle ; formateur, stagiaire : celle de la navigation jouée)."""
    attendu = {"direction": 'a.nav-entree[href="#/promos"], a.nav-case[href="#/promos"]',
               "siege": 'a.nav-entree[href="#/directions"], a.nav-case[href="#/directions"]'}.get(espace)
    if attendu is None:
        attendu = ('#tabs a.tab[href="#/planning"]' if v.navigation == "ancienne"
                   else 'a.nav-entree[href="#/planning"], a.nav-case[href="#/planning"], a.nav-onglet[href="#/planning"]')
    v.attendre(attendu, "la barre de l'espace %s" % ESPACE_DE_LA_BARRE[espace])
    # Nouvelle navigation : la barre du stagiaire porte « Mon suivi » et jamais « Stagiaires » ; celle de l'équipe l'inverse. (L'ancienne
    # barre est la même pour les deux : rien à y distinguer.)
    if v.navigation == "nouvelle" and espace in ("stagiaire", "equipe"):
        entrees = ":is(a.nav-onglet, a.nav-entree, a.nav-case)"
        propre = 'a[href="#/mon-suivi"]' if espace == "stagiaire" else 'a[href="#/stagiaires"]'
        etranger = 'a[href="#/stagiaires"]' if espace == "stagiaire" else 'a[href="#/mon-suivi"]'
        v.attendre(entrees + propre, "l'entrée propre à la barre de l'espace %s" % ESPACE_DE_LA_BARRE[espace])
        if v.voit(entrees + etranger):
            v.constat("D", BLOQUE, "la barre de l'espace %s porte encore l'entrée d'un autre espace" % ESPACE_DE_LA_BARRE[espace], capture=True)
    if espace in ("direction", "siege") and v.voit("#tabs a.tab"):
        v.constat("D", BLOQUE, "l'ancienne barre reste affichée dans l'espace %s" % ESPACE_DE_LA_BARRE[espace], capture=True)
    v.espace = espace


def choisir_un_espace(v, espace, compter=False):
    """Menu du compte, section « Espace », l'espace voulu : l'app se recharge sur son accueil, avec sa barre."""
    ouvrir_le_menu_du_compte(v, compter)
    v.toucher('[data-espace-choix="%s"]' % espace, "« %s » (choix de l'espace)" % ESPACE_DE_LA_BARRE[espace], compte=compter,
               attendu_effet=False)     # le choix recharge l'app
    verifier_la_barre(v, espace)


def recharger(v, quoi):
    """L'appareil recharge la page (F5) : l'app rouvre ce que la personne avait choisi."""
    v.etape(quoi)
    v._poser_espion()
    v.page.reload(wait_until="load")
    v._attendre_calme(calme=300, maximum=6000)


@parcours("direction-et-formateur-changent-d-espace", "P3 · Une direction qui forme choisit son espace (menu du compte)", role="direction",
          budget=2, banc={"compte": "dirform"}, depart=DEPART)
def direction_et_formateur(v):
    """Menu du compte, Espace : Formateur puis Direction. La barre change à chaque choix, le choix est gardé au rechargement. La promo où
    elle forme a l'interrupteur éteint (ancienne navigation) ou allumé (nouvelle) : la direction a sa barre dans les deux cas."""
    verifier_la_barre(v, "direction")
    choisir_un_espace(v, "equipe", compter=True)
    v.but("espace Formateur choisi")
    recharger(v, "recharger l'espace Formateur")
    verifier_la_barre(v, "equipe")
    choisir_un_espace(v, "direction")
    attendre_page(v, "Vue d'ensemble")
    recharger(v, "recharger l'espace Direction")
    verifier_la_barre(v, "direction")
    attendre_page(v, "Vue d'ensemble")
    v.terminer()


@parcours("direction-d-un-autre-centre-formatrice", "P3 · Une direction formatrice ailleurs arrive sur son centre dirigé", role="direction",
          budget=1, banc={"compte": "dirailleurs", "lieux": "2"}, depart=DEPART)
def direction_ailleurs(v):
    """La promo affichée au départ est celle où elle forme (Montpellier) : entrer dans la direction ouvre le centre qu'elle dirige (Nîmes)."""
    verifier_la_barre(v, "direction")
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.but("accueil du centre dirigé")
    page = v.texte("#view").lower()
    if "nîmes" not in page:
        v.constat("D", BLOQUE, "l'accueil de la direction n'est pas celui du centre qu'elle dirige (Nîmes)", capture=True)
    if "montpellier" in page:
        v.constat("E", BLOQUE, "l'accueil de la direction montre le centre où elle ne fait que former (Montpellier)", capture=True)
    v.terminer()


# --- Voir en tant que (P5) ---------------------------------------------------------------------------------------------------------

APERCUS = [("Direction", "direction", "Direction du centre %s"), ("Siège", "siege", "Siège du réseau"),
           ("Formateur", "equipe", "Formateur"), ("Stagiaire", "stagiaire", "Stagiaire")]


def choisir_un_apercu(v, bouton, espace, libelle_bandeau, compter=False):
    """Menu du compte, « Voir en tant que », un rôle : l'espace, la barre et le bandeau d'aperçu changent."""
    v.etape("aperçu : %s" % bouton)
    ouvrir_le_menu_du_compte(v, compter)
    v.toucher(texte(bouton, ".view-as-btn"), "« %s » (Voir en tant que)" % bouton, compte=compter, attendu_effet=False)
    v.attendre("#impersonation-banner", "le bandeau d'aperçu")
    verifier_la_barre(v, espace)
    bandeau = v.texte("#impersonation-banner")
    # Le rôle est le mot en gras du bandeau : on le compare en entier (« Stagiaire » ne passe pas pour « Formateur »).
    dit = v.page.locator("#impersonation-banner strong").first.inner_text().strip()
    if dit != libelle_bandeau:
        v.constat("D", BLOQUE, "le bandeau d'aperçu dit « %s » au lieu de « %s »" % (dit[:60], libelle_bandeau), capture=True)


def revenir_fondateur(v):
    v.etape("revenir fondateur")
    v.toucher("#impersonation-banner button.imp-back", "« Revenir fondateur »", compte=False)
    v.page.wait_for_function("() => !document.getElementById('impersonation-banner')", timeout=10000)
    verifier_la_barre(v, "equipe")


def promos_affichees(v):
    return sorted(int(x) for x in v.page.evaluate("() => [...document.querySelectorAll('#view .promo-carte')].map((e) => e.dataset.promo)"))


def jouer_les_apercus(v, promos_attendues, centre):
    """Les quatre aperçus, puis le retour ; en aperçu Direction, seules les promos du centre de la promo affichée sont montrées."""
    for i, (bouton, espace, libelle) in enumerate(APERCUS):
        choisir_un_apercu(v, bouton, espace, libelle % centre if "%s" in libelle else libelle, compter=(i == 0))
        if i == 0:
            v.but("aperçu Direction")
        if espace == "direction":
            v.aller("Promos")
            attendre_page(v, "Promos")
            v.attendre("#view .promo-carte", "les cartes des promos")
            vues = promos_affichees(v)
            if vues != promos_attendues:
                v.constat("E", BLOQUE, "l'aperçu Direction montre les promos %s au lieu de %s (celles du centre affiché)" % (vues, promos_attendues),
                          capture=True)
    revenir_fondateur(v)
    v.terminer()


@parcours("apercus-du-fondateur-promo-1", "P5 · Le fondateur voit en tant que Direction, Siège, Formateur, Stagiaire (promo 1, interrupteur éteint)",
          role="fondateur", budget=2, banc={"centre": "1"}, depart="#/home")
def apercus_promo_1(v):
    """Promo 1 (Nîmes) : les quatre aperçus, la barre et le bandeau justes, puis « Revenir fondateur » ; l'aperçu Direction ne montre que
    les promos de Nîmes (pas celle du centre de démonstration, que le compte lit aussi)."""
    jouer_les_apercus(v, [1, 2], "Nîmes")


@parcours("apercus-du-fondateur-promo-7", "P5 · Le fondateur voit en tant que Direction, Siège, Formateur, Stagiaire (promo 7, allumée)",
          role="fondateur", budget=2, banc={"centre": "1", "demo": "1"}, depart="#/home",
          semis=("FIXTURES.settings.push({ key: 'navigation_v2', value: String(PARAMS_BANC.get('nav2') === '1'), promo_id: 7 });",))
def apercus_promo_7(v):
    """Promo 7 (centre de démonstration, interrupteur allumé) : mêmes aperçus ; l'aperçu Direction ne montre que la promo 7."""
    jouer_les_apercus(v, [7], "Démonstration")


# --- Une adresse tapée hors de son espace (P6, P7), la porte (P8), la fiche d'un autre centre (P9) -------------------------------

ADRESSES_NEUVES = ["#/promos", "#/equipe", "#/reseau", "#/directions"]
PHRASE_SANS_PROMO = "Aucune promo n'est associée à ton compte. Demande à ta direction ou à un formateur de t'ajouter."
PHRASE_FICHE_AILLEURS = "Cette fiche n'est pas dans ton centre."


def saisir_une_adresse(v, adresse):
    """Poser l'adresse comme le ferait un lien ou une adresse tapée dans l'app ouverte (l'app ignore le hash au démarrage)."""
    v._poser_espion()
    v.page.evaluate("(h) => { location.hash = h; }", adresse)
    v._attendre_calme(calme=300, maximum=4000)


def jouer_les_adresses_hors_espace(v, libelle):
    """Chaque page de la direction ou du siège, tapée par quelqu'un d'un autre espace : l'accueil de son espace et la phrase qui dit
    pourquoi ; son menu du compte n'a pas de section Espace."""
    phrase = "Cette page n'est pas dans l'espace %s." % libelle
    for i, adresse in enumerate(ADRESSES_NEUVES):
        v.etape("adresse saisie : %s" % adresse)
        v.ecouter_messages()
        saisir_une_adresse(v, adresse)
        v.exiger_confirmation("l'adresse %s" % adresse, phrase)
        if v._hash() != "#/home":
            v.constat("D", BLOQUE, "l'adresse %s mène à %s et non à l'accueil de l'espace" % (adresse, v._hash() or "(rien)"),
                      capture=True)
        v.attendre("#view :is(h1, h2, h3):visible", "l'accueil de l'espace %s" % libelle)
        v.controler_ecran("hors espace " + adresse)
        if i == 0:
            v.but("accueil de l'espace %s et sa phrase" % libelle)
    v.etape("le menu du compte n'a pas de section Espace")
    ouvrir_le_menu_du_compte(v)
    v.attendre("button:has-text(\"Se déconnecter\"):visible", "le menu du compte")
    if v.voit("[data-espace-choix], #compte-espace-titre, #nav-espace-titre"):
        v.constat("D", BLOQUE, "le menu du compte propose un choix d'espace à un compte qui n'en a qu'un", capture=True)
    v.page.keyboard.press("Escape")
    v._attendre_calme(calme=300, maximum=3000)
    if v.voit(".modal-backdrop .modal"):         # le menu de l'ancienne barre se ferme par « Fermer »
        v.toucher(texte("Fermer", ".modal button"), "« Fermer » (menu du compte)", compte=False)
    v.terminer()


@parcours("adresses-hors-espace-formateur", "P6 · Un formateur tape l'adresse d'une page de la direction ou du siège", role="formateur", budget=1)
def adresses_formateur(v):
    """#/promos, #/equipe, #/reseau, #/directions : l'accueil de l'espace Formateur et « Cette page n'est pas dans l'espace Formateur. »"""
    jouer_les_adresses_hors_espace(v, "Formateur")


@parcours("adresses-hors-espace-stagiaire", "P7 · Un stagiaire tape l'adresse d'une page de la direction ou du siège", role="stagiaire", budget=1)
def adresses_stagiaire(v):
    """Mêmes adresses : l'accueil de l'espace Stagiaire et « Cette page n'est pas dans l'espace Stagiaire. »"""
    jouer_les_adresses_hors_espace(v, "Stagiaire")


@parcours("compte-sans-role-a-la-porte", "P8 · Un compte sans rôle se connecte et la porte le refuse", role="stagiaire", budget=1,
          banc={"compte": "sansrole", "role": "anon"}, navigations=NOUVELLE, ouverture="porte")
def sans_role(v):
    """Connexion d'un compte qui n'a aucun rôle : la porte dit qu'aucune promo n'est associée au compte et à qui s'adresser."""
    v.remplir("#gate-email", "sans.role@exemple.invalid", "l'adresse e-mail")
    v.remplir("#gate-password", "mot-de-passe-du-banc", "le mot de passe")
    v.toucher("#gate-submit", "« Se connecter »", ecriture=True)
    v.attendre('.gate :text("%s"), #gate-error:has-text("%s"), #gate-info:has-text("%s")' % ((PHRASE_SANS_PROMO,) * 3),
               "la phrase du refus à la porte")
    v.but("refus à la porte")
    if v.voit(SELECTEUR_BARRE):
        v.constat("D", BLOQUE, "l'app s'ouvre pour un compte sans rôle", capture=True)
    v.terminer()


@parcours("direction-fiche-d-un-autre-centre", "P9 · Une direction tape l'adresse d'une fiche d'un autre centre", role="direction", budget=1,
          banc={"compte": "direction", "lieux": "2", "emargement2": "1"}, navigations=NOUVELLE, depart=DEPART)
def fiche_d_un_autre_centre(v):
    """Direction de Nîmes, fiche d'un stagiaire de Montpellier : « Cette fiche n'est pas dans ton centre. », rien de Montpellier à l'écran."""
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.but("accueil du centre")
    v.etape("adresse de la fiche d'un stagiaire de Montpellier")
    saisir_une_adresse(v, "#/stagiaires/31")
    v.attendre('#view :has-text("%s")' % PHRASE_FICHE_AILLEURS, "« %s »" % PHRASE_FICHE_AILLEURS)
    v.controler_ecran("fiche d'un autre centre")
    aucun_nom_de_stagiaire(v, "la page de la fiche d'un autre centre", prenoms=PRENOMS_PROMO_2)
    if "montpellier" in v.page.evaluate("() => document.body.innerText").lower():
        v.constat("E", BLOQUE, "la page de la fiche d'un autre centre nomme Montpellier", capture=True)
    v.terminer()


# --- La base en panne (P10) --------------------------------------------------------------------------------------------------------


PHRASE_CONNEXION = "La connexion a échoué. Vérifie le réseau, puis réessaie."


def exiger_une_phrase_dans_la_fenetre(v, quoi):
    """Dans la fenêtre restée ouverte, une phrase de refus est écrite en moins de 2 s (critère E). Rend la phrase."""
    try:
        v.page.locator(".modal .promo-refus:not(:empty)").first.wait_for(state="visible", timeout=2000)
    except Exception:
        v.constat("E", BLOQUE, "%s : aucune phrase d'échec dans la fenêtre en 2 s" % quoi, capture=True)
        return ""
    phrase = v.page.locator(".modal .promo-refus").first.inner_text().strip()
    # Une coupure de réseau se dit en français : jamais le texte technique de la requête.
    if phrase != PHRASE_CONNEXION:
        v.constat("E", BLOQUE, "%s : la phrase d'échec est « %s » au lieu de « %s »" % (quoi, phrase[:70], PHRASE_CONNEXION), capture=True)
    return phrase


def fermer_la_fenetre(v, quoi):
    v.fermer_par_echap(".modal", quoi)
    if v.voit(".modal"):
        v.toucher(texte("Annuler", ".modal button"), "« Annuler »", compte=False)


@parcours("panne-direction-inviter-un-formateur", "P10 · Base en panne : inviter un formateur", role="direction", budget=1,
          banc={"compte": "direction", "panne": "regler_affectations_formateur"}, navigations=NOUVELLE, depart=DEPART)
def panne_inviter(v):
    """regler_affectations_formateur en panne : la fenêtre reste ouverte avec sa saisie et dit que l'invitation n'a pas abouti."""
    v.console_attendue("TypeError: Failed to fetch")
    v.aller("Équipe")
    attendre_page(v, "Équipe")
    v.but("page Équipe")
    v.toucher(texte("Inviter un formateur", "#view button"), "« Inviter un formateur »", compte=False)
    v.remplir("#equipe-email", "nouveau.formateur@exemple.invalid", "l'adresse du formateur")
    v.toucher("#equipe-promo-1", "la case de la promo de mars", compte=False, attendu_effet=False)
    v.toucher(texte("Inviter", ".modal button[type=submit]"), "« Inviter »", compte=False, ecriture=True)
    phrase = exiger_une_phrase_dans_la_fenetre(v, "l'invitation en panne")
    v.etape("la saisie est gardée")
    if v.page.locator("#equipe-email").input_value() != "nouveau.formateur@exemple.invalid":
        v.constat("E", BLOQUE, "l'adresse saisie est perdue après l'échec de l'invitation", capture=True)
    v.etape("phrase : " + phrase[:60])
    fermer_la_fenetre(v, "la fenêtre d'invitation")
    v.terminer()


@parcours("panne-direction-creer-une-promo", "P10 · Base en panne : créer une promo", role="direction", budget=1,
          banc={"compte": "direction", "panne": "creer_promo"}, navigations=NOUVELLE, depart=DEPART)
def panne_creer_promo(v):
    """creer_promo en panne : la fenêtre reste ouverte avec sa saisie et dit que la création n'a pas abouti."""
    v.console_attendue("TypeError: Failed to fetch")
    attendre_page(v, "Promos")        # la page de départ
    v.but("page Promos")
    v.toucher(texte("Créer une promo", "#view button"), "« Créer une promo »", compte=False)
    v.remplir("#promo-nom", "Promo de novembre 2026", "le nom de la promo")
    v.remplir("#promo-debut", "2026-11-16", "le début de la promo")
    v.toucher(texte("Créer la promo", ".modal button"), "« Créer la promo »", compte=False, ecriture=True)
    phrase = exiger_une_phrase_dans_la_fenetre(v, "la création de promo en panne")
    v.etape("la saisie est gardée")
    if v.page.locator("#promo-nom").input_value() != "Promo de novembre 2026":
        v.constat("E", BLOQUE, "le nom saisi est perdu après l'échec de la création", capture=True)
    v.etape("phrase : " + phrase[:60])
    fermer_la_fenetre(v, "la fenêtre de création")
    v.terminer()
