# -*- coding: utf-8 -*-
"""Parcours des titres et droits à la carte (étape 3, Task 33) : inviter, ajuster, « Voir n'écrit pas », « Mon titre », aperçu par titre.

Les comptes viennent du banc (`banc={"compte": ...}`, voir _harness_supabase.js) : `direction` (direction du lieu 1, qui donne et ajuste les
titres), `secretariat` (titre de centre Secrétariat au lieu 1 : Promos en Voir, Stagiaires en Modifier, Émargement et Équipe en Voir) et
`intervenant` (titre de promo Intervenant sur la promo 1 : Planning et Stagiaires en Voir, Émargement en Modifier). Le levier `titres_ouverts=1`
lève le verrou des titres non fixes (fermé au départ). Le banc garde en mémoire ce que les fonctions des titres écrivent ; la base, elle, se
prouve par les preuves SQL : ces parcours prouvent l'écran, pas l'enregistrement.

Un identifiant par profil : un parcours n'a qu'un compte (`inviter` et `ajuster` pour la direction, `voir-n-ecrit-pas-*` et `mon-titre-*` pour
chaque profil, `apercu-par-titre` pour le fondateur).
"""
from . import parcours
from .direction import (NOUVELLE, attendre_page, choisir_un_apercu, fermer_la_fenetre, ouvrir_le_menu_du_compte, revenir_fondateur, saisir_une_adresse,
                        verifier_la_barre)
from .navigation import SOUS_ONGLET, texte
from .visite import BLOQUE

TITRES_OUVERTS = {"titres_ouverts": "1"}
FENETRE = ".confirmer-fond"
MODALE = ".modal"


def banc_de(compte, **plus):
    return dict(TITRES_OUVERTS, compte=compte, **plus)


def aucun(v, selecteur, quoi, critere="E"):
    """Rien de ce sélecteur ne doit être visible : un bouton d'écriture qu'une case « Voir » laisserait serait un défaut bloquant."""
    if v.voit(selecteur):
        v.constat(critere, BLOQUE, "%s : un bouton d'écriture reste visible" % quoi, capture=True)


# --- Inviter, ajuster (la direction) ---------------------------------------------------------------------------------------------------

@parcours("titres-inviter-un-intervenant", "Titres · La direction invite un intervenant sur une promo de son centre", role="direction", budget=1,
          banc=banc_de("direction"), navigations=NOUVELLE, depart="#/centre")
def inviter_un_intervenant(v):
    """Équipe, une adresse, le titre Intervenant (verrou ouvert), la promo de mars : ce que le titre ouvre et masque se dit avant l'envoi,
    « Compte créé » confirme, et la personne paraît dans la liste avec son titre."""
    v.aller("Équipe")
    attendre_page(v, "Équipe")
    v.attendre("#equipe-titre", "le choix du titre")
    v.remplir("#equipe-email", "noa.intervenant@exemple.invalid", "l'adresse de la personne")
    v.page.locator("#equipe-titre").select_option(label="Intervenant")
    v.attendre('#view .equipe-droits li:text-is("Planning : Voir")', "ce que le titre Intervenant ouvre (Planning : Voir)")
    v.attendre('#view .equipe-apercu :text("Masqué dans sa barre")', "ce que le titre masque")
    if v.voit("#equipe-fiche:visible"):
        v.constat("E", BLOQUE, "la fiche formateur est offerte pour un titre qui n'est pas Formateur", capture=True)
    v.toucher("#equipe-promo-1", "la case de la promo de mars", compte=False, attendu_effet=False)
    v.ecouter_messages()
    v.toucher('#view form.equipe-inviter button[type=submit]', "« Inviter »", compte=False, ecriture=True)
    v.exiger_confirmation("l'invitation de l'intervenant", "Compte créé")
    v.attendre('#view tr[data-email="noa.intervenant@exemple.invalid"]', "la personne dans « Personnes avec accès »")
    ligne = v.texte('#view tr[data-email="noa.intervenant@exemple.invalid"]')
    if "Intervenant" not in ligne:
        v.constat("E", BLOQUE, "la personne invitée n'affiche pas le titre Intervenant dans la liste", capture=True)
    v.but("intervenant invité")
    v.terminer()


@parcours("titres-ajuster-un-titre", "Titres · La direction ajuste le titre Secrétariat : version du centre, Stagiaires relevé", role="direction",
          budget=1, banc=banc_de("direction"), navigations=NOUVELLE, depart="#/centre")
def ajuster_un_titre(v):
    """Équipe, « Ajuster » sur Secrétariat (titre du réseau) : Stagiaires passe à Non puis Notes et examens à Voir, ce qui relève Stagiaires à
    Voir et le dit ; la confirmation annonce la version du centre ; le titre se lit ensuite comme version du centre."""
    v.aller("Équipe")
    attendre_page(v, "Équipe")
    v.toucher('button[aria-label="Ajuster le titre Secrétariat"]', "« Ajuster » sur Secrétariat", compte=False)
    v.attendre(MODALE + ' fieldset[data-page="stagiaires"]', "la fenêtre « Ajuster un titre »")
    v.attendre(MODALE + ' :text("l\'ajuster crée la version de votre centre")', "la phrase de la version du centre")
    v.toucher(MODALE + ' fieldset[data-page="stagiaires"] label:has(input[value="non"])', "Stagiaires : Non", compte=False, attendu_effet=False)
    v.toucher(MODALE + ' fieldset[data-page="notes"] label:has(input[value="voir"])', "Notes et examens : Voir", compte=False, attendu_effet=False)
    v.attendre(MODALE + ' .equipe-releve:has-text("Stagiaires passe à")', "la phrase qui dit que Stagiaires est relevé")
    if not v.page.locator(MODALE + ' fieldset[data-page="stagiaires"] input[value="voir"]').is_checked():
        v.constat("E", BLOQUE, "Stagiaires n'est pas relevé à Voir quand Notes et examens montre des noms", capture=True)
    v.ecouter_messages()
    v.toucher(MODALE + " button[type=submit]", "« Enregistrer »", compte=False, attendu_effet=False)
    v.attendre(FENETRE + ':has-text("Créer la version de votre centre")', "la confirmation de la version du centre")
    v.toucher(FENETRE + ' button:text-is("Ajuster")', "« Ajuster » (la confirmation)", compte=False, ecriture=True)
    v.exiger_confirmation("l'ajustement du titre", "Version de votre centre créée")
    v.attendre('#view tr[data-titre]:has(strong:text-is("Secrétariat")):has-text("version d\'un titre du réseau")',
               "Secrétariat lu comme version du centre")
    v.but("titre ajusté")
    v.etape("rouvrir le titre : Stagiaires est resté relevé à Voir")
    v.toucher('button[aria-label="Ajuster le titre Secrétariat"]', "« Ajuster » sur la version du centre", compte=False)
    v.attendre(MODALE + ' fieldset[data-page="stagiaires"]', "la fenêtre « Ajuster un titre » rouverte")
    if not v.page.locator(MODALE + ' fieldset[data-page="stagiaires"] input[value="voir"]').is_checked():
        v.constat("E", BLOQUE, "rouvert, le titre ajusté a perdu le relèvement de Stagiaires à Voir", capture=True)
    fermer_la_fenetre(v, "la fenêtre « Ajuster un titre »")
    v.terminer()


# --- Voir n'écrit pas ------------------------------------------------------------------------------------------------------------------
# Chaque absence se prouve avec un TÉMOIN : le même contrôle, joué par un compte qui a la case à « Modifier », voit les boutons. Sans témoin, un écran cassé
# ou un sélecteur périmé ferait passer le parcours. Les boutons choisis sont ceux que la case de la page garde (ecritSelonLaCase), non le titre fixe.

PROMOS_ECRITURE = (("#view " + 'button:text-is("Modules")', "« Modules »"),
                   (texte("Créer une promo", "#view button"), "« Créer une promo »"))
AJOUTER_UN_EVENEMENT = '#view button:text-is("Ajouter un événement")'
ONGLET_BENEVOLES = '#view :is(button.subtab, [role=tab]):text-is("Élèves bénévoles")'


def controle_promos(v, avec):
    """Promos : « Créer une promo » et « Modules » (case Promos en Modifier) sont là, ou ne sont pas là ; les cartes des promos, elles, y sont toujours."""
    v.aller("Promos")
    attendre_page(v, "Promos")
    v.attendre("#view .promo-carte", "les cartes des promos")
    for selecteur, nom in PROMOS_ECRITURE:
        if avec:
            v.attendre(selecteur, "%s (la case Promos est en Modifier)" % nom)
        else:
            aucun(v, selecteur, "Promos en « Voir » : %s" % nom)


def controle_equipe(v, avec):
    """Planning, Dates clés : « Ajouter un événement » (case Planning) ; Stagiaires : le sous-onglet « Élèves bénévoles » (case Stagiaires). La page
    se lit dans les deux cas (le filtre « À venir », la liste des stagiaires)."""
    v.aller("Planning")
    attendre_page(v, "Planning")
    v.toucher(texte("Dates clés", SOUS_ONGLET), "« Dates clés »", compte=False)
    v.attendre('#view .agenda-filters button:text-is("À venir")', "la page Dates clés, qui se lit")
    if avec:
        v.attendre(AJOUTER_UN_EVENEMENT, "« Ajouter un événement » (la case Planning est en Modifier)")
    else:
        aucun(v, AJOUTER_UN_EVENEMENT, "Planning en « Voir » : « Ajouter un événement »")
    v.but("Planning relu")
    v.etape("Stagiaires")
    v.aller("Stagiaires")
    attendre_page(v, "Stagiaires")
    v.attendre("#view a.stg-ligne", "la liste des stagiaires, qui se lit")
    if avec:
        v.attendre(ONGLET_BENEVOLES, "« Élèves bénévoles » (la case Stagiaires est en Modifier)")
    else:
        aucun(v, ONGLET_BENEVOLES, "Stagiaires en « Voir » : « Élèves bénévoles »")
    v.terminer()


@parcours("titres-voir-n-ecrit-pas-secretariat", "Titres · Un Secrétariat sur Promos (case « Voir ») ne voit aucun bouton d'écriture", role="direction",
          budget=1, banc=banc_de("secretariat"), navigations=NOUVELLE, depart="#/centre")
def voir_n_ecrit_pas_secretariat(v):
    """Promos en lecture : les cartes sont là, sans « Créer une promo » ni « Modules » ; Stagiaires (Modifier) garde son geste « Gérer »."""
    controle_promos(v, avec=False)
    v.but("Promos en lecture")
    v.etape("Stagiaires en Modifier garde ses gestes")
    v.aller("Stagiaires")
    attendre_page(v, "Stagiaires")
    v.attendre(texte("Gérer", "#view button"), "« Gérer » (la case Stagiaires est en Modifier)")
    v.terminer()


@parcours("titres-voir-n-ecrit-pas-temoin-direction", "Titres · Témoin : la direction fixe voit les boutons que le Secrétariat n'a pas sur Promos", role="direction",
          budget=1, banc=banc_de("direction"), navigations=NOUVELLE, depart="#/centre")
def temoin_direction(v):
    """Le même contrôle que le Secrétariat, joué par un compte dont la case Promos est à Modifier : « Créer une promo » et « Modules » sont là."""
    controle_promos(v, avec=True)
    v.but("Promos en écriture")
    v.terminer()


@parcours("titres-voir-n-ecrit-pas-intervenant", "Titres · Un Intervenant (Planning et Stagiaires en « Voir ») ne voit aucun bouton d'écriture", role="formateur",
          budget=1, banc=banc_de("intervenant"), navigations=NOUVELLE, depart="#/home")
def voir_n_ecrit_pas_intervenant(v):
    """Planning, Dates clés : sans « Ajouter un événement » ; Stagiaires : sans « Élèves bénévoles » ; les deux pages se lisent."""
    controle_equipe(v, avec=False)


@parcours("titres-voir-n-ecrit-pas-temoin-formateur", "Titres · Témoin : le Formateur fixe voit les boutons que l'Intervenant n'a pas", role="formateur",
          budget=1, banc=banc_de("formateur"), navigations=NOUVELLE, depart="#/home")
def temoin_formateur(v):
    """Le même contrôle que l'Intervenant, joué par un compte dont les cases Planning et Stagiaires sont à Modifier : « Ajouter un événement » et
    « Élèves bénévoles » sont là."""
    controle_equipe(v, avec=True)


# --- Mon titre (le menu du compte) -----------------------------------------------------------------------------------------------------

def lire_mon_titre(v, nom, droits, absents):
    """Menu du compte : « Mon titre » nomme le titre ; « Ce que je peux faire » se déplie sur les pages et leur case, et seulement elles."""
    ouvrir_le_menu_du_compte(v, compter=True)
    v.attendre('[data-nav-coquille="compte"] .nav-mon-titre-nom:has-text("%s")' % nom, "« Mon titre » : %s" % nom)
    v.toucher('[data-nav-coquille="compte"] .nav-mon-titre-droits summary', "« Ce que je peux faire »", compte=False)
    liste = '[data-nav-coquille="compte"] .nav-mon-titre-liste'
    for page, valeur in droits:
        v.attendre('%s li:has(span:text-is("%s")):has(b:text-is("%s"))' % (liste, page, valeur), "« %s : %s »" % (page, valeur))
    for page in absents:
        if v.voit('%s li:has(span:text-is("%s"))' % (liste, page)):
            v.constat("E", BLOQUE, "« Ce que je peux faire » montre « %s », que ce titre n'ouvre pas" % page, capture=True)
    v.but("titre lu")
    v.terminer()


@parcours("titres-mon-titre-secretariat", "Titres · Un Secrétariat lit son titre et ce qu'il peut faire dans le menu du compte", role="direction",
          budget=2, banc=banc_de("secretariat"), navigations=NOUVELLE, depart="#/centre")
def mon_titre_secretariat(v):
    """« Mon titre » : Secrétariat · Nîmes ; « Ce que je peux faire » : Promos Voir, Stagiaires Modifier, Émargement Voir, Équipe Voir ; ni Notes
    et examens ni Réglages du centre."""
    lire_mon_titre(v, "Secrétariat", [("Promos", "Voir"), ("Stagiaires", "Modifier"), ("Émargement", "Voir"), ("Équipe", "Voir")],
                   ["Notes et examens", "Réglages du centre"])


@parcours("titres-mon-titre-intervenant", "Titres · Un Intervenant lit son titre et ce qu'il peut faire dans le menu du compte", role="formateur",
          budget=2, banc=banc_de("intervenant"), navigations=NOUVELLE, depart="#/home")
def mon_titre_intervenant(v):
    """« Mon titre » : Intervenant ; « Ce que je peux faire » : Planning Voir, Émargement Modifier, Stagiaires Voir ; ni Notes et examens ni
    Réglages."""
    lire_mon_titre(v, "Intervenant", [("Planning", "Voir"), ("Émargement", "Modifier"), ("Stagiaires", "Voir")],
                   ["Notes et examens", "Réglages"])


# --- Aperçu par titre (le fondateur) ---------------------------------------------------------------------------------------------------

@parcours("titres-apercu-par-titre", "Titres · Le fondateur voit en tant que Formateur sous le titre Intervenant", role="fondateur", budget=4,
          banc=dict(TITRES_OUVERTS, centre="1"), depart="#/home")
def apercu_par_titre(v):
    """Menu du compte, Voir en tant que Formateur, puis le choix « Titre » : Intervenant. La barre perd les pages que le titre ne montre pas et
    « Mon titre » nomme Intervenant ; revenir au titre Formateur rend la barre entière ; « Revenir fondateur » ferme l'aperçu."""
    notes = ':is(a.nav-entree, a.nav-case)[href="#/notes"]:visible'
    choisir_un_apercu(v, "Formateur", "equipe", "Formateur", compter=True)
    v.attendre(notes, "« Notes et examens » dans la barre du titre fixe Formateur")
    v.etape("choisir le titre Intervenant")
    ouvrir_le_menu_du_compte(v, compter=True)
    v.toucher('.view-as-titre-btn:text-is("Intervenant")', "« Intervenant » (choix du titre)", compte=True, attendu_effet=False)
    v.page.wait_for_function(
        "() => ![...document.querySelectorAll('a[href=\"#/notes\"]')].some((e) => e.offsetParent && /nav-(entree|case)/.test(e.className))",
        timeout=10000)
    verifier_la_barre(v, "equipe")
    v.but("aperçu sous le titre Intervenant")
    if v.voit(notes):
        v.constat("E", BLOQUE, "sous le titre Intervenant, la barre garde « Notes et examens »", capture=True)
    ouvrir_le_menu_du_compte(v)
    v.attendre('[data-nav-coquille="compte"] .nav-mon-titre-nom:has-text("Intervenant")', "« Mon titre » : Intervenant")
    v.etape("revenir au titre fixe Formateur")
    v.toucher('.view-as-titre-btn:text-is("Formateur")', "« Formateur » (choix du titre)", compte=False, attendu_effet=False)
    v.page.wait_for_selector(notes, state="visible", timeout=10000)
    revenir_fondateur(v)
    v.terminer()


# --- Une page à « Non » se ferme à l'adresse tapée -------------------------------------------------------------------------------------
PHRASE_PAGE_FERMEE = "Vous n'avez pas accès à cette page avec votre titre."


@parcours("titres-page-a-non-adresse-secretariat", "Titres · Un Secrétariat tape l'adresse de Notes et examens (case « Non ») : la page se ferme", role="direction",
          budget=1, banc=banc_de("secretariat"), navigations=NOUVELLE, depart="#/centre")
def page_a_non_secretariat(v):
    """#/notes, page que le titre Secrétariat n'ouvre pas : la phrase « pas d'accès », l'accueil du centre, et aucune page de notes à l'écran."""
    v.attendre("#view :is(h1, h2, h3):visible", "l'accueil du centre")
    v.ecouter_messages()
    saisir_une_adresse(v, "#/notes")
    v.exiger_confirmation("l'adresse #/notes", PHRASE_PAGE_FERMEE)
    if v._hash() != "#/centre":
        v.constat("D", BLOQUE, "l'adresse #/notes mène à %s et non à l'accueil du centre" % (v._hash() or "(rien)"), capture=True)
    if v.voit("#view .notes-compte, #view .notes-vide"):
        v.constat("E", BLOQUE, "la page Notes et examens s'affiche malgré la case « Non »", capture=True)
    v.but("page fermée, accueil du centre")
    v.terminer()


@parcours("titres-page-a-non-adresse-temoin-formateur", "Titres · Témoin : le Formateur fixe ouvre #/notes normalement", role="formateur",
          budget=1, banc=banc_de("formateur"), navigations=NOUVELLE, depart="#/home")
def page_a_non_temoin(v):
    """Même geste, joué par un compte dont la case Notes et examens est à « Modifier » : l'adresse reste et la page s'ouvre, sans la phrase."""
    v.ecouter_messages()
    saisir_une_adresse(v, "#/notes")
    v.attendre("#view :is(h1, h2, h3):visible", "la page Notes et examens")
    if v._hash() != "#/notes":
        v.constat("D", BLOQUE, "l'adresse #/notes mène à %s pour un compte qui a la page" % (v._hash() or "(rien)"), capture=True)
    if any(PHRASE_PAGE_FERMEE.lower() in m["texte"].lower() for m in v._journal()):
        v.constat("E", BLOQUE, "la phrase « pas d'accès » apparaît pour un compte qui a la page", capture=True)
    v.but("page ouverte")
    v.terminer()
