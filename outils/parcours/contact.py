# -*- coding: utf-8 -*-
"""Parcours de l'espace contact, partie annuaire (page Contacts, ma fiche, coordonnées des stagiaires, délégué, financements).

Le banc joue les fonctions de la base en mémoire avec leurs règles et leurs phrases (voir le bloc « Espace contact » de
_harness_supabase.js) : un parcours qui enregistre prouve l'écran et le reflet de l'enregistrement, pas la base (preuves SQL :
tests/sql/contact-annuaire-preuve.sql). Leviers : `fiche_contact=a_verifier`, `contact_depart=1`, `ecritures=1`.
"""
from . import parcours
from .direction import saisir_une_adresse
from .visite import BLOQUE, LISTE

NOUVELLE = ("nouvelle",)
BUDGET_CONTACTS = {"ordinateur": 2, "telephone": 3}
PAGE = "#view .contacts-page"
FENETRE = ".contact-modal"
PHRASE_VERIFIER = "Vérifiez votre fiche de contact : les stagiaires ne voient que votre nom tant qu'elle n'est pas enregistrée."
PHRASE_DELEGUE = "Il y a déjà un délégué de ce rang dans cette promo."
# Les numéros fictifs du banc : aucun ne doit apparaître là où le stagiaire n'a pas à les voir.
TEL_STAGIAIRE = "06 00 00 00 01"


def carte(nom):
    return '%s .contact-carte:has-text("%s")' % (PAGE, nom)


def champ(libelle, balise="input"):
    """Le champ d'une fenêtre ou d'un formulaire, par son étiquette exacte."""
    return '.field:has(> label:text-is("%s")) > %s' % (libelle, balise)


def noms_des_cartes(v):
    return v.page.evaluate("() => [...document.querySelectorAll('#view .contacts-page .contact-carte .contact-nom')].map((e) => e.innerText.trim())")


@parcours("annuaire-stagiaire", "Un stagiaire trouve qui joindre au centre", role="stagiaire", budget=BUDGET_CONTACTS, navigations=NOUVELLE)
def annuaire_stagiaire(v):
    """Menu du compte, « Contacts » : l'équipe du centre (nom, pour quoi, quand, Appeler) et « Ta promo » sans aucun numéro."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("L\'équipe du centre")', "« L'équipe du centre »")
    v.attendre(carte("Alice Exemple"), "la fiche d'une personne du secrétariat")
    v.attendre(PAGE + ' h3:text-is("Ta promo")', "« Ta promo »")
    v.but("page Contacts ouverte")
    page = v.texte("#view")
    if "pour quoi me joindre" not in page.lower() or "Absences et justificatifs" not in page:
        v.constat("F", BLOQUE, "la fiche du secrétariat ne dit pas pour quoi la joindre")
    if not v.voit(carte("Alice Exemple") + ' a:has-text("Appeler")'):
        v.constat("F", BLOQUE, "la fiche du secrétariat n'a pas de bouton « Appeler »")
    if "Bruno Exemple" not in page:
        v.constat("F", BLOQUE, "la fiche partagée avec un autre centre manque à Nîmes")
    if "Fanny Exemple" in page:
        v.constat("F", BLOQUE, "une fiche du centre de démonstration apparaît à Nîmes")
    # Une fiche avec compte non vérifiée : son nom, pas ses coordonnées.
    if "pour quoi me joindre" in v.texte(carte("Edith Exemple")).lower():
        v.constat("F", BLOQUE, "une fiche non vérifiée montre déjà ses coordonnées")
    # Ta promo : des noms, jamais un numéro ni une adresse.
    promo = v.texte(PAGE + ' section[aria-labelledby="contact-promo-titre"]')
    if TEL_STAGIAIRE in promo or v.voit(PAGE + ' section[aria-labelledby="contact-promo-titre"] a[href^="tel:"]'):
        v.constat("F", BLOQUE, "« Ta promo » montre un numéro de téléphone à un stagiaire")
    if v.voit(PAGE + ' button:text-is("Modifier"), ' + PAGE + ' button:has-text("Ajouter une fiche")'):
        v.constat("F", BLOQUE, "un stagiaire voit un geste d'écriture sur l'annuaire")
    v.terminer()


@parcours("annuaire-equipe-ajoute", "Un formateur ajoute une fiche sans compte et la range", role="formateur", budget=BUDGET_CONTACTS,
          navigations=NOUVELLE, banc={"ecritures": "1"})
def annuaire_equipe_ajoute(v):
    """« Ajouter une fiche » (fenêtre), enregistrer : la fiche est dans la liste ; « Monter » la passe avant la précédente."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("L\'équipe du centre")', "« L'équipe du centre »")
    v.attendre(PAGE + ' button:has-text("Ajouter une fiche")', "« Ajouter une fiche »")
    v.but("page Contacts de l'équipe ouverte")
    v.toucher(PAGE + ' button:has-text("Ajouter une fiche")', "« Ajouter une fiche »", compte=False)
    v.attendre(FENETRE + ' h3:text-is("Ajouter une fiche")', "la fenêtre d'une nouvelle fiche")
    v.remplir(FENETRE + " " + champ("Prénom"), "Hélène", "le prénom")
    v.remplir(FENETRE + " " + champ("Nom"), "Exemple", "le nom")
    v.remplir(FENETRE + " " + champ("Libellé (fonction)"), "Comptabilité", "le libellé")
    v.remplir(FENETRE + " " + champ("Pour quoi me joindre"), "Factures", "« Pour quoi me joindre »")
    v.ecouter_messages()
    v.toucher(FENETRE + ' button:text-is("Enregistrer")', "« Enregistrer »", compte=False, ecriture=True)
    v.exiger_confirmation("l'ajout de la fiche", "Fiche ajoutée")
    v.attendre(carte("Hélène Exemple"), "la nouvelle fiche dans la liste")
    if v.voit(FENETRE):
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après l'enregistrement", capture=True)
    avant = noms_des_cartes(v)
    v.etape("monter la nouvelle fiche")
    v.ecouter_messages()
    v.toucher('%s button[aria-label="Monter Hélène Exemple"]' % PAGE, "« Monter » sur la nouvelle fiche", compte=False, ecriture=True)
    v.page.wait_for_function("(n) => { const l = [...document.querySelectorAll('#view .contacts-page .contact-nom')].map((e) => e.innerText.trim());"
                             " return l.indexOf('Hélène Exemple') === n; }", arg=avant.index("Hélène Exemple") - 1, timeout=5000)
    v.terminer()


@parcours("ma-fiche-verifiee", "Un formateur vérifie sa fiche de contact", role="formateur", budget=BUDGET_CONTACTS, navigations=NOUVELLE,
          banc={"fiche_contact": "a_verifier", "ecritures": "1"})
def ma_fiche_verifiee(v):
    """Mes préférences : l'encadré demande de vérifier la fiche ; « Enregistrer » la vérifie (l'encadré et le rappel d'Aujourd'hui partent)."""
    v.aller("Mes préférences")
    v.attendre("#view .ma-fiche h3:text-is(\"Ma fiche de contact\")", "« Ma fiche de contact »")
    v.attendre("#view .ma-fiche .contact-encadre", "l'encadré qui demande de vérifier la fiche")
    v.but("fiche à vérifier ouverte")
    if v.texte("#view .ma-fiche .contact-encadre").strip() != PHRASE_VERIFIER:
        v.constat("F", BLOQUE, "l'encadré ne dit pas la phrase attendue")
    v.remplir("#view .ma-fiche " + champ("Téléphone professionnel"), "04 00 00 00 99", "le téléphone professionnel")
    v.ecouter_messages()
    v.toucher('#view .ma-fiche button:text-is("Enregistrer")', "« Enregistrer »", compte=False, ecriture=True)
    v.exiger_confirmation("l'enregistrement de la fiche", "Fiche enregistrée")
    try:
        v.page.locator("#view .ma-fiche .contact-encadre").wait_for(state="hidden", timeout=3000)
    except Exception:
        v.constat("E", BLOQUE, "l'encadré reste affiché après l'enregistrement de la fiche", capture=True)
    if v.page.locator('#view .ma-fiche input[type=tel]').first.input_value() != "04 00 00 00 99":
        v.constat("E", BLOQUE, "le téléphone enregistré n'est pas relu dans la fiche")
    v.etape("le rappel d'Aujourd'hui est parti")
    v.aller("Aujourd'hui")
    v.attendre("#view h1:has-text(\"Aujourd'hui\")", "la page Aujourd'hui")
    if v.voit('#view a[href="#/preferences"]:text-is("%s")' % PHRASE_VERIFIER):
        v.constat("E", BLOQUE, "Aujourd'hui rappelle encore de vérifier la fiche une fois enregistrée")
    v.terminer()


@parcours("coordonnees-stagiaire", "La direction règle le financement et le rang d'un stagiaire", role="direction", budget=1,
          navigations=NOUVELLE, banc={"compte": "direction", "ecritures": "1"}, depart="#/promos")
def coordonnees_stagiaire(v):
    """Fiche d'un stagiaire : « Modifier » (téléphone, financement, rang) ; le bloc relit le financement et le rang enregistrés."""
    saisir_une_adresse(v, "#/stagiaires/1")
    v.attendre("#view .fiche-coordonnees dl", "le bloc des coordonnées")
    v.attendre('#view .fiche-coordonnees button:text-is("Modifier")', "« Modifier » (la direction règle les coordonnées)")
    v.but("coordonnées affichées")
    if not v.voit('#view .fiche-coordonnees dd:text-is("CPF")'):
        v.constat("F", BLOQUE, "le financement du stagiaire n'est pas affiché")
    v.toucher('#view .fiche-coordonnees button:text-is("Modifier")', "« Modifier »", compte=False)
    v.attendre(FENETRE + ' h3:text-is("Modifier les coordonnées")', "la fenêtre des coordonnées")
    v.page.locator("#coord-fin").select_option(label="Région")
    v.page.locator("#coord-delegue").select_option(value="suppleant")
    v.ecouter_messages()
    v.toucher(FENETRE + ' button:text-is("Enregistrer")', "« Enregistrer »", compte=False, ecriture=True)
    v.exiger_confirmation("l'enregistrement des coordonnées", "Coordonnées enregistrées")
    v.attendre('#view .fiche-coordonnees dd:text-is("Région")', "le financement enregistré dans le bloc")
    v.attendre('#view .fiche-coordonnees dd:text-is("Suppléant")', "le rang enregistré dans le bloc")
    if v.voit(FENETRE):
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après l'enregistrement", capture=True)
    v.terminer()


@parcours("coordonnees-stagiaire-lecture", "Un stagiaire lit ses coordonnées sans pouvoir les modifier", role="stagiaire", budget=1,
          navigations=NOUVELLE)
def coordonnees_stagiaire_lecture(v):
    """Mon suivi : le bloc des coordonnées montre téléphone et financement, renvoie vers Mes préférences, sans « Modifier »."""
    v.aller("Mon suivi")
    v.attendre("#view .fiche-coordonnees dl", "le bloc des coordonnées")
    v.but("coordonnées affichées")
    if v.voit('#view .fiche-coordonnees button:text-is("Modifier")'):
        v.constat("F", BLOQUE, "un stagiaire peut modifier ses coordonnées depuis sa fiche (« Modifier »)")
    if not v.voit('#view .fiche-coordonnees a[href="#/preferences"]'):
        v.constat("F", LISTE, "le bloc ne renvoie pas vers Mes préférences pour changer le téléphone")
    v.attendre('#view .fiche-coordonnees dd:text-is("CPF")', "son financement")
    v.terminer()


@parcours("delegue-deja-pris", "Un second délégué du même rang est refusé avec sa phrase", role="formateur", budget=1, navigations=NOUVELLE,
          banc={"ecritures": "1"}, depart="#/planning",
          semis=("FIXTURES.stagiaires.find((s) => s.id === 2).delegue = 'titulaire';",))
def delegue_deja_pris(v):
    """Le stagiaire 2 est déjà délégué : donner le même rang au stagiaire 1 est refusé (23505) ; la fenêtre reste ouverte avec la phrase."""
    saisir_une_adresse(v, "#/stagiaires/1")
    v.attendre('#view .fiche-coordonnees button:text-is("Modifier")', "« Modifier »")
    v.but("fiche ouverte")
    v.toucher('#view .fiche-coordonnees button:text-is("Modifier")', "« Modifier »", compte=False)
    v.attendre(FENETRE + ' h3:text-is("Modifier les coordonnées")', "la fenêtre des coordonnées")
    v.page.locator("#coord-delegue").select_option(value="titulaire")
    v.console_attendue("coordonnées du stagiaire")
    v.toucher(FENETRE + ' button:text-is("Enregistrer")', "« Enregistrer »", compte=False, ecriture=True)
    v.attendre(FENETRE + ' :text("%s")' % PHRASE_DELEGUE, "la phrase du rang déjà pris")
    if not v.voit(FENETRE):
        v.constat("D", BLOQUE, "la fenêtre se ferme malgré le refus")
    v.toucher(FENETRE + ' button:text-is("Annuler")', "« Annuler »", compte=False)
    v.terminer()


@parcours("annuaire-direction", "La direction voit son annuaire, ses départs et ses financements", role="direction", budget=BUDGET_CONTACTS,
          navigations=NOUVELLE, banc={"compte": "direction", "contact_depart": "1"}, depart="#/promos")
def annuaire_direction(v):
    """Contacts (menu du compte) : « Ajouter une fiche », sa fiche et le départ d'une personne ; Réglages du centre : Financements et fiches à supprimer."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("L\'équipe du centre")', "« L'équipe du centre »")
    v.attendre(PAGE + ' button:has-text("Ajouter une fiche")', "« Ajouter une fiche »")
    v.but("page Contacts de la direction ouverte")
    v.attendre(carte("Éric Exemple") + ' .contact-pastille:text-is("A quitté le centre")', "la fiche de la personne partie, signalée")
    v.attendre(carte("Edith Exemple") + ' .contact-pastille:text-is("Votre fiche")', "sa propre fiche, signalée")
    if "Stagiaires de la promo" not in v.texte("#view"):
        v.constat("F", BLOQUE, "la direction ne voit pas les stagiaires de la promo avec leurs coordonnées")
    v.etape("Réglages du centre : financements et fiches à supprimer")
    v.aller("Réglages du centre")
    v.attendre('#view h3:text-is("Financements")', "la section « Financements »")
    v.attendre('#view .reglage-financements input[value="CPF"]', "le financement CPF")
    v.attendre('#view h3:text-is("Fiches à supprimer")', "la section « Fiches à supprimer »")
    v.attendre('#view .reglage-fiches-a-supprimer :text("Éric Exemple")', "la personne partie dans « Fiches à supprimer »")
    v.terminer()


@parcours("annuaire-autre-centre", "Un stagiaire d'un autre centre ne voit que les contacts de son centre", role="stagiaire", budget=BUDGET_CONTACTS,
          navigations=NOUVELLE, banc={"centre": "1", "demo": "1", "fiche": "1634"})
def annuaire_autre_centre(v):
    """Stagiaire de la promo de démonstration : l'annuaire est celui de son centre, aucune fiche de Nîmes."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("L\'équipe du centre")', "« L'équipe du centre »")
    v.attendre(carte("Fanny Exemple"), "la fiche du centre de démonstration")
    v.but("annuaire du centre de démonstration")
    page = v.texte("#view")
    for nom in ("Alice Exemple", "Bruno Exemple", "Denis Exemple", "Edith Exemple"):
        if nom in page:
            v.constat("F", BLOQUE, "la fiche d'un autre centre apparaît (%s)" % nom.split()[0])
    v.terminer()
