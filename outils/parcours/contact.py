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


# === Les demandes (tâches 11 à 13) : écrire au centre, suivi, Messages, page du lien d'e-mail, réglages « Qui reçoit quoi ». ===
# Le banc joue les fonctions de la base en mémoire (bloc « Espace contact » de _harness_supabase.js) : un parcours prouve l'écran et le reflet de
# l'écriture, pas la base (preuves SQL : tests/sql/contact-demandes-preuve.sql). Leviers : `ecritures=1`, `contact_regle=1`.
BUDGET_MESSAGES = {"ordinateur": 1, "telephone": 2}
PAGE_DEMANDE = "#view .demande-page"
PHRASE_RIEN_REGLE = "Rien n'est réglé : pour chaque demande, le stagiaire choisit qui prévenir parmi les formateurs de sa promo et la direction du centre."
PHRASE_LIEN_INVALIDE = "Ce lien n'est plus valable. Ouvrez la demande dans l'app ou demandez un nouvel envoi."
JETON_VALIDE, JETON_DEJA, JETON_EXPIRE = "V" * 43, "D" * 43, "E" * 43
PAGE_LIEN = "_harness_demande.html#j="


def ouvrir_ecrire_au_centre(v):
    """Contacts, « Écrire au centre » : la fenêtre s'ouvre ; rend le sélecteur du bouton d'envoi."""
    v.aller("Contacts")
    v.attendre(PAGE + ' button:text-is("Écrire au centre")', "« Écrire au centre »")
    v.attendre(PAGE + ' h3:text-is("Mes demandes")', "« Mes demandes »")
    v.but("page Contacts du stagiaire ouverte")
    v.toucher(PAGE + ' button:text-is("Écrire au centre")', "« Écrire au centre »", compte=False)
    v.attendre(FENETRE + ' h3:text-is("Écrire au centre")', "la fenêtre « Écrire au centre »")
    v.attendre(FENETRE + ' .contact-encadre :text("Sera envoyé à")', "l'encadré « Sera envoyé à »")
    return FENETRE + ' button:text-is("Envoyer")'


def remplir_message(v, sujet, texte):
    v.remplir(FENETRE + " " + champ("Sujet"), sujet, "le sujet")
    v.remplir(FENETRE + " " + champ("Message", "textarea"), texte, "le message")


@parcours("ecrire-au-centre-choix", "Un stagiaire écrit au centre quand rien n'est réglé : il coche qui prévenir", role="stagiaire",
          budget=BUDGET_CONTACTS, navigations=NOUVELLE, banc={"ecritures": "1"})
def ecrire_au_centre_choix(v):
    """Le centre n'a rien réglé : des cases, « Envoyer » inactif tant qu'aucune n'est cochée ; une case cochée, l'envoi mène au suivi « Envoyée »."""
    envoyer = ouvrir_ecrire_au_centre(v)
    v.attendre(FENETRE + ' .contact-encadre input[type=checkbox]', "les cases des personnes à prévenir")
    v.attendre(FENETRE + ' .contact-encadre :text("coche au moins une personne")', "la phrase qui demande de cocher")
    v.etape("un retard : le formateur du jour est déjà coché")
    if not v.page.locator(FENETRE + ' label.contact-case:has-text("Denis Exemple") input').is_checked():
        v.constat("F", BLOQUE, "pour un retard, le formateur du jour n'est pas coché d'office")
    v.etape("une question administrative : rien n'est coché, « Envoyer » est inactif")
    v.page.locator(FENETRE + " " + champ("Type", "select")).select_option(label="Question administrative")
    v.page.wait_for_function("() => document.querySelectorAll('.contact-modal .ecrire-cases input:checked').length === 0", timeout=5000)
    if not v.page.locator(envoyer).is_disabled():
        v.constat("E", BLOQUE, "« Envoyer » est actif alors qu'aucune personne n'est cochée", capture=True)
    remplir_message(v, "Question sur mon dossier", "Peux-tu me dire où en est mon dossier ?")
    if not v.page.locator(envoyer).is_disabled():
        v.constat("E", BLOQUE, "« Envoyer » devient actif sans personne cochée (le sujet suffit)")
    v.toucher(FENETRE + ' label.contact-case:has-text("Edith Exemple")', "la case « Edith Exemple »", compte=False)
    v.page.wait_for_function("() => !document.querySelector('.contact-modal .btn.primary').disabled", timeout=5000)
    v.ecouter_messages()
    v.toucher(envoyer, "« Envoyer »", compte=False, ecriture=True)
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Envoyée")', "le suivi de la demande, étape « Envoyée »")
    v.attendre(PAGE_DEMANDE + ' h2:text-is("Question sur mon dossier")', "le sujet de la demande")
    v.attendre(PAGE_DEMANDE + ' .demande-destinataires li:text-is("Edith Exemple")', "la personne cochée, dans « Destinataires »")
    if v.voit(FENETRE):
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après l'envoi", capture=True)
    if v.voit(PAGE_DEMANDE + ' .demande-destinataires li:has-text("Denis Exemple")'):
        v.constat("E", BLOQUE, "une personne non cochée reçoit la demande")
    v.terminer()


@parcours("ecrire-au-centre-regle", "Un stagiaire écrit au centre quand le centre a réglé qui reçoit : les noms, aucune case", role="stagiaire",
          budget=BUDGET_CONTACTS, navigations=NOUVELLE, banc={"ecritures": "1", "contact_regle": "1"})
def ecrire_au_centre_regle(v):
    """La règle du centre désigne une personne en congé : son relais est nommé dans « Sera envoyé à », aucune case, l'envoi est possible."""
    envoyer = ouvrir_ecrire_au_centre(v)
    nom = "Alice Exemple, relais de Bruno Exemple"
    v.attendre(FENETRE + ' .contact-encadre :text("%s")' % nom, "le relais nommé dans l'encadré")
    if v.voit(FENETRE + ' input[type=checkbox]'):
        v.constat("E", BLOQUE, "des cases apparaissent alors que le centre a réglé qui reçoit")
    remplir_message(v, "Retard demain", "Je serai là à 9 h 30.")
    if v.page.locator(envoyer).is_disabled():
        v.constat("E", BLOQUE, "« Envoyer » est inactif alors que le destinataire est réglé", capture=True)
    v.ecouter_messages()
    v.toucher(envoyer, "« Envoyer »", compte=False, ecriture=True)
    v.attendre(PAGE_DEMANDE + ' .demande-destinataires li:text-is("%s")' % nom, "le relais, dans « Destinataires »")
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Envoyée")', "l'étape « Envoyée »")
    v.terminer()


@parcours("destinataire-avec-compte", "Un formateur ouvre une absence reçue et répond en un geste", role="formateur", budget=BUDGET_MESSAGES,
          navigations=NOUVELLE, banc={"ecritures": "1"})
def destinataire_avec_compte(v):
    """Messages : l'absence est « À traiter » ; la réponse toute faite « Absence enregistrée » la fait passer à « Prise en compte »."""
    v.aller("Messages")
    v.attendre('#view h3:text-is("À traiter (1)")', "« À traiter (1) »")
    ligne = '#view li.demande-ligne:has-text("Absence jeudi matin")'
    v.attendre(ligne + ".demande-neuve", "l'absence, marquée nouvelle")
    v.but("Messages ouverts, l'absence à traiter est là")
    if v.voit('#view li.demande-ligne:has-text("Attestation de présence")'):
        v.constat("E", BLOQUE, "le formateur voit une demande qui ne lui est pas adressée")
    v.toucher(ligne + " a.demande-lien", "l'absence", compte=False)
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Envoyée")', "le suivi, étape « Envoyée »")
    v.attendre(PAGE_DEMANDE + ' .demande-destinataires li:text-is("Denis Exemple")', "le destinataire")
    bouton = PAGE_DEMANDE + ' .demande-toutes-faites button:text-is("Absence enregistrée")'
    v.attendre(bouton, "la réponse toute faite « Absence enregistrée »")
    if not v.voit(PAGE_DEMANDE + ' button:text-is("Pris en compte")'):
        v.constat("F", BLOQUE, "le bouton « Pris en compte » manque pour un destinataire")
    v.ecouter_messages()
    v.toucher(bouton, "« Absence enregistrée »", compte=False, ecriture=True)
    v.exiger_confirmation("la réponse", "Réponse envoyée")
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Prise en compte")', "l'étape « Prise en compte »")
    v.attendre(PAGE_DEMANDE + ' .demande-message-texte:text-is("Absence enregistrée")', "la réponse dans « Échanges »")
    if v.voit(PAGE_DEMANDE + ' button:text-is("Pris en compte")'):
        v.constat("E", BLOQUE, "« Pris en compte » reste proposé une fois la demande prise")
    v.terminer()


@parcours("page-du-lien", "Un lien d'e-mail ouvre la demande, un seul bouton fait le geste", role="stagiaire", budget=1, navigations=NOUVELLE,
          depart=PAGE_LIEN + JETON_VALIDE, ouverture="page")
def page_du_lien(v):
    """Jeton valide : la demande et un seul bouton, « C'est fait » après le toucher ; jeton déjà fait : « Déjà fait » ; jeton expiré : la phrase."""
    racine = "#lien-demande"
    v.attendre(racine + ' h1.lien-demande-sujet:text-is("Absence jeudi matin")', "la demande")
    bouton = racine + ' button.lien-demande-bouton'
    v.attendre(bouton + ':text-is("Confirmer : Absence enregistrée")', "le bouton unique du geste")
    v.but("la page du lien est ouverte")
    if v.page.locator(racine + " button").count() != 1:
        v.constat("F", BLOQUE, "la page n'a pas exactement un bouton")
    if v.voit(racine + " input, " + racine + " textarea"):
        v.constat("F", BLOQUE, "la page du lien porte un champ de saisie")
    v.toucher(bouton, "« Confirmer : Absence enregistrée »", compte=False, ecriture=True)
    v.attendre(racine + ' h1:text-is("C\'est fait")', "« C'est fait »")
    for jeton, titre, quoi in ((JETON_DEJA, "Déjà fait", "un lien déjà utilisé"), (JETON_EXPIRE, "Lien invalide", "un lien expiré")):
        v.etape(quoi)
        v.page.goto("about:blank")      # un changement de fragment seul ne recharge pas la page : on repart d'une page vide
        v.page.goto(v.base_url + PAGE_LIEN + jeton, wait_until="load")
        v.attendre(racine + ' h1:text-is("%s")' % titre, "« %s »" % titre)
        v.controler_ecran(quoi)
    if PHRASE_LIEN_INVALIDE not in v.texte(racine):
        v.constat("F", BLOQUE, "la phrase du lien expiré n'est pas celle attendue")
    v.terminer()


@parcours("messages-direction", "La direction lit toutes les demandes de son centre", role="direction", budget=BUDGET_MESSAGES,
          navigations=NOUVELLE, banc={"compte": "direction"}, depart="#/promos")
def messages_direction(v):
    """Messages : les demandes du centre (même celles adressées à d'autres), rangées en « Ouvertes » ; la direction peut prendre en compte."""
    v.aller("Messages")
    v.attendre('#view h2:text-is("Messages")', "le titre « Messages »")
    v.attendre('#view li.demande-ligne:has-text("Attestation de présence")', "une demande adressée au secrétariat")
    v.attendre('#view li.demande-ligne:has-text("Absence jeudi matin")', "une demande adressée à un formateur")
    v.but("Messages de la direction ouverts")
    v.attendre('#view button:text-is("Écrire à un stagiaire")', "« Écrire à un stagiaire »")
    v.attendre('#view button:text-is("Écrire à un collègue")', "« Écrire à un collègue »")
    v.attendre('#view h3:text-is("Ouvertes (2)")', "« Ouvertes (2) »")
    v.toucher('#view li.demande-ligne:has-text("Attestation de présence") a.demande-lien', "la demande", compte=False)
    v.attendre(PAGE_DEMANDE + ' h2:text-is("Attestation de présence")', "le suivi de la demande")
    v.attendre(PAGE_DEMANDE + ' button:text-is("Pris en compte")', "« Pris en compte » (la direction y a droit)")
    v.attendre(PAGE_DEMANDE + ' .demande-toutes-faites button:text-is("Bien reçu")', "les réponses toutes faites")
    v.terminer()


@parcours("autre-centre", "Un formateur d'un autre centre ne voit aucune demande de Nîmes", role="formateur", budget=BUDGET_MESSAGES,
          navigations=NOUVELLE, banc={"centre": "1", "demo": "1"})
def autre_centre(v):
    """Promo de démonstration : Messages est vide, aucune demande de Nîmes n'y apparaît."""
    v.aller("Messages")
    v.attendre('#view h2:text-is("Messages")', "le titre « Messages »")
    v.attendre('#view p:text-is("Rien à traiter.")', "« Rien à traiter. »")
    v.but("Messages du centre de démonstration ouverts")
    page = v.texte("#view")
    for morceau in ("Absence jeudi matin", "Attestation de présence", "Agathe O.", "Lison K."):
        if morceau in page:
            v.constat("F", BLOQUE, "une demande d'un autre centre apparaît (%s)" % morceau)
    v.terminer()


@parcours("rien-regle", "La direction voit que rien n'est réglé : le stagiaire choisit", role="direction", budget=BUDGET_CONTACTS,
          navigations=NOUVELLE, banc={"compte": "direction"}, depart="#/promos")
def rien_regle(v):
    """Réglages du centre, « Qui reçoit quoi » : la phrase « Rien n'est réglé » en tête, et l'aperçu dit « le stagiaire choisit »."""
    v.aller("Réglages du centre")
    v.attendre('#view .reglage-regles h3:text-is("Qui reçoit quoi")', "la section « Qui reçoit quoi »")
    v.attendre('#view .reglage-regles .contact-encadre', "l'encadré de tête")
    v.but("réglages du centre ouverts")
    if v.texte('#view .reglage-regles .contact-encadre').strip() != PHRASE_RIEN_REGLE:
        v.constat("F", BLOQUE, "l'encadré de tête ne dit pas « Rien n'est réglé »")
    v.attendre('#view .reglage-regles .regle-apercu li:has-text("le stagiaire choisit")', "l'aperçu « le stagiaire choisit »")
    v.attendre('#view .reglage-reponses h3:text-is("Réponses toutes faites")', "la section « Réponses toutes faites »")
    v.terminer()


@parcours("cumul-equipe-contacts", "Le fondateur (stagiaire et administrateur) a la vue de l'équipe sur Contacts et Écrire", role="fondateur",
          budget=BUDGET_CONTACTS, navigations=NOUVELLE, banc={"ecritures": "1"})
def cumul_equipe_contacts(v):
    """Compte cumulé en espace équipe : Contacts est vouvoyé, sans « Écrire au centre » ni « Mes demandes » ; « Écrire » sur une fiche n'a ni type ni case ; la base refuse l'envoi, Messages est vide."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("L\'équipe du centre")', "« L'équipe du centre »")
    v.attendre(carte("Denis Exemple") + ' button:has-text("Écrire")', "« Écrire » sur une fiche")
    v.but("page Contacts ouverte par le compte cumulé")
    if v.voit(PAGE + ' button:text-is("Écrire au centre")') or v.voit(PAGE + ' h3:text-is("Mes demandes")'):
        v.constat("F", BLOQUE, "le compte cumulé en espace équipe voit « Écrire au centre » ou « Mes demandes » (vue du stagiaire)")
    if "Qui joindre au centre, pour quoi et quand." not in v.texte(PAGE) or "Tape sur Appeler" in v.texte(PAGE):
        v.constat("F", BLOQUE, "le sous-titre de Contacts est celui du stagiaire (tutoiement)")
    v.toucher(carte("Denis Exemple") + ' button:has-text("Écrire")', "« Écrire » sur la fiche de Denis", compte=False)
    v.attendre(FENETRE + ' h3:text-is("Écrire à Denis Exemple")', "la fenêtre d'écriture à une fiche")
    if v.voit(FENETRE + " " + champ("Type", "select")) or v.voit(FENETRE + " input[type=checkbox]"):
        v.constat("E", BLOQUE, "la fenêtre d'écriture montre un type ou des cases (vue du stagiaire)")
    remplir_message(v, "Dossier de la promo", "Pouvez-vous me rappeler ?")
    # La base ne reconnaît au fondateur ni stagiaire ni fiche de l'équipe (preuve contact-2) : elle refuse, l'écran dit sa phrase et reste ouvert.
    v.console_attendue("écrire")
    v.toucher(FENETRE + ' button:text-is("Envoyer")', "« Envoyer »", compte=False, ecriture=True)
    v.attendre(FENETRE + ' .contact-erreur-general:has-text("Réservé aux stagiaires")', "la phrase de refus de la base")
    if v.texte(FENETRE + " .contact-erreur-general").strip() != "Réservé aux stagiaires et à l'équipe du centre.":
        v.constat("F", BLOQUE, "la phrase de refus n'est pas celle de la base")
    if not v.voit(FENETRE) or v.page.evaluate("() => location.hash") != "#/contacts":
        v.constat("E", BLOQUE, "après le refus, la fenêtre se ferme ou la page change")
    v.toucher(FENETRE + ' button:text-is("Annuler")', "« Annuler »", compte=False)
    v.etape("Messages : l'entrée de l'équipe ouvre la page (vide), pas Contacts")
    v.aller("Messages")
    v.attendre('#view h2:text-is("Messages")', "le titre « Messages »")
    v.attendre('#view p:text-is("Rien à traiter.")', "« Rien à traiter. » : le compte cumulé n'a aucune demande")
    v.terminer()


# === Les absences annoncées (tâches 15 à 17) : prévenir, suivre, justificatif, avis du formateur du jour et du délégué, planning, émargement. ===
# Le banc joue prevenir_absence et ses phrases en mémoire (bloc « Espace contact » de _harness_supabase.js) : un parcours prouve l'écran et le
# reflet de l'écriture, pas la base (preuves SQL : tests/sql/contact-absences-preuve.sql). Leviers : `ecritures=1`, `contact_regle=1`,
# `justificatif=1`, `formateur_du_jour=1`, `delegue=1`, `absence_planning=1`, `absence=annoncee`. Le geste « l'équipe règle le justificatif »
# n'est pas un geste de l'écran : le parcours le joue par `window.__bancContact.justificatif(état)`.
BUDGET_ABSENCE = {"ordinateur": 6, "telephone": 6}
ABSENCE = ".absence-page"
ENVOYER_ABSENCE = ABSENCE + ' .abs-envoi button:text-is("Envoyer")'
ENVOI_ACTIF = "() => !document.querySelector('.abs-envoi .btn.primary').disabled"
ENVOI_INACTIF = "() => document.querySelector('.abs-envoi .btn.primary').disabled"
PHRASE_DECOCHEES = "Ils ne seront pas prévenus, mais l'absence apparaîtra au planning."


def choix_absence(nom):
    """Le bouton rond d'un choix (jour, moment, motif) de « Prévenir d'une absence » : l'étiquette entière se touche."""
    return ABSENCE + ' label.abs-choix:has(span:text-is("%s"))' % nom


def ouvrir_prevenir(v):
    """Accueil du stagiaire, puis « Prévenir d'une absence » : l'écran s'ouvre."""
    v.aller("Accueil")
    v.attendre('#view .acc-absence-bouton', "le bouton « Prévenir d'une absence » de l'Accueil")
    v.toucher('#view .acc-absence-bouton', "« Prévenir d'une absence »")
    v.attendre(ABSENCE + ' h2:text-is("Prévenir d\'une absence")', "l'écran « Prévenir d'une absence »")


def remplir_absence(v, jour="Demain", moment="Matin", motif="Santé"):
    for nom in (jour, moment, motif):
        v.toucher(choix_absence(nom), "« %s »" % nom)


def coche(v, libelle):
    return v.page.locator(ABSENCE + ' label.contact-case:has-text("%s") input' % libelle)


@parcours("absence-complete", "Un stagiaire prévient d'une absence, la suit, et le justificatif est reçu", role="stagiaire", budget=BUDGET_ABSENCE,
          navigations=NOUVELLE, banc={"ecritures": "1"})
def absence_complete(v):
    """Rien n'est réglé : demain matin, Santé, le formateur du jour déjà coché ; l'envoi mène au suivi ; l'équipe note le justificatif à remettre
    (rappel sur l'Accueil), puis reçu (le rappel part, le suivi dit « Justificatif reçu »)."""
    ouvrir_prevenir(v)
    remplir_absence(v)
    v.attendre(ABSENCE + ' .abs-encadre :text("Sera envoyé à")', "l'encadré « Sera envoyé à »")
    v.attendre(ABSENCE + ' label.contact-case:has-text("Denis Exemple")', "la case du formateur du jour")
    v.etape("le formateur du jour est déjà coché, rien d'autre")
    if not coche(v, "Denis Exemple").is_checked():
        v.constat("F", BLOQUE, "le formateur du jour n'est pas coché d'office")
    if coche(v, "Edith Exemple").is_checked():
        v.constat("F", BLOQUE, "la direction est cochée d'office")
    v.page.wait_for_function(ENVOI_ACTIF, timeout=5000)
    v.ecouter_messages()
    v.toucher(ENVOYER_ABSENCE, "« Envoyer »", ecriture=True)
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Envoyée")', "le suivi, étape « Envoyée »")
    v.attendre(PAGE_DEMANDE + ' .demande-absence dd:text-is("Santé")', "le motif, dans la section « Absence »")
    v.attendre(PAGE_DEMANDE + ' .demande-absence dd:has-text("29 octobre, matin")', "le jour et le moment")
    v.attendre(PAGE_DEMANDE + ' .demande-destinataires li:has-text("Denis Exemple")', "le formateur prévenu")
    v.attendre(PAGE_DEMANDE + ' .demande-absence a:text-is("Envoyer mon justificatif")', "« Envoyer mon justificatif »")
    if v.voit(ABSENCE):
        v.constat("D", BLOQUE, "l'écran d'absence reste affiché après l'envoi", capture=True)
    v.but("absence envoyée et suivie")
    v.etape("l'équipe demande le justificatif : le rappel est sur l'Accueil")
    v.page.evaluate("() => window.__bancContact.justificatif('a_remettre')")
    v.aller("Accueil")
    v.attendre('#view :text("Remets ton justificatif")', "le rappel du justificatif sur l'Accueil")
    v.etape("l'équipe note le justificatif reçu : le rappel part, le suivi le dit")
    v.page.evaluate("() => window.__bancContact.justificatif('recu')")
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("Mes demandes")', "« Mes demandes »")
    v.toucher(PAGE + " li.demande-ligne a.demande-lien", "l'absence, dans « Mes demandes »", compte=False)
    v.attendre(PAGE_DEMANDE + ' .demande-absence dd:text-is("Justificatif reçu")', "« Justificatif reçu » dans le suivi")
    if v.voit(PAGE_DEMANDE + ' .demande-absence a:text-is("Envoyer mon justificatif")'):
        v.constat("E", BLOQUE, "« Envoyer mon justificatif » reste proposé alors que le justificatif est reçu")
    v.aller("Accueil")
    v.attendre('#view .acc-absence-bouton', "l'Accueil rechargé")
    if "Remets ton justificatif" in v.texte("#view"):
        v.constat("E", BLOQUE, "le rappel du justificatif reste sur l'Accueil alors qu'il est reçu", capture=True)
    v.terminer()


@parcours("absence-sans-choix", "« Envoyer » reste inactif quand plus personne n'est cochée", role="stagiaire", budget=BUDGET_ABSENCE,
          navigations=NOUVELLE, banc={"ecritures": "1"})
def absence_sans_choix(v):
    """Rien n'est réglé : la case du formateur du jour décochée, « Envoyer » est inactif, la phrase demande de cocher quelqu'un et le formateur du
    jour reste dit « en copie » ; recochée, « Envoyer » redevient actif."""
    ouvrir_prevenir(v)
    remplir_absence(v)
    v.attendre(ABSENCE + ' label.contact-case:has-text("Denis Exemple")', "la case du formateur du jour")
    v.page.wait_for_function(ENVOI_ACTIF, timeout=5000)
    v.toucher(ABSENCE + ' label.contact-case:has-text("Denis Exemple")', "la case « Denis Exemple »")
    v.but("case du formateur du jour décochée")
    v.page.wait_for_function(ENVOI_INACTIF, timeout=5000)
    v.attendre(ABSENCE + ' .abs-aide:has-text("coche au moins une personne")', "la phrase qui demande de cocher quelqu'un")
    v.attendre(ABSENCE + ' .abs-annexes :text("Formateurs du jour en copie : Denis Exemple")', "le formateur du jour, en copie")
    v.toucher(ABSENCE + ' label.contact-case:has-text("Denis Exemple")', "la case « Denis Exemple »", compte=False)
    v.page.wait_for_function(ENVOI_ACTIF, timeout=5000)
    v.terminer()


@parcours("absence-cases-decochees", "Les copies décochées : la phrase dit que l'absence apparaît quand même au planning", role="stagiaire",
          budget=BUDGET_ABSENCE, navigations=NOUVELLE, banc={"ecritures": "1", "contact_regle": "1"})
def absence_cases_decochees(v):
    """Le centre a réglé qui reçoit : aucune case de destinataire, deux copies cochées (formateurs du jour, délégué) ; décochées, la phrase s'affiche ;
    « Envoyer » reste actif."""
    ouvrir_prevenir(v)
    remplir_absence(v)
    v.attendre(ABSENCE + ' .abs-encadre :text("Alice Exemple, relais de Bruno Exemple")', "le relais nommé dans l'encadré")
    v.attendre(ABSENCE + ' .abs-annexes label.contact-case:has-text("Ton délégué en copie")', "la copie du délégué")
    v.attendre(ABSENCE + ' .abs-annexes label.contact-case:has-text("Formateurs du jour en copie")', "la copie des formateurs du jour")
    if v.voit(ABSENCE + ' :text("Ils ne seront pas prévenus")'):
        v.constat("F", BLOQUE, "la phrase des copies décochées s'affiche alors que tout est coché")
    v.page.wait_for_function(ENVOI_ACTIF, timeout=5000)
    v.but("copies cochées")
    v.toucher(ABSENCE + ' .abs-annexes label.contact-case:has-text("Formateurs du jour en copie")', "la case « Formateurs du jour en copie »", compte=False)
    v.toucher(ABSENCE + ' .abs-annexes label.contact-case:has-text("Ton délégué en copie")', "la case « Ton délégué en copie »", compte=False)
    v.attendre(ABSENCE + ' .abs-encadre :text("%s")' % PHRASE_DECOCHEES, "la phrase des copies décochées")
    if v.page.locator(ENVOYER_ABSENCE).is_disabled():
        v.constat("E", BLOQUE, "« Envoyer » est inactif alors que la règle du centre désigne le destinataire", capture=True)
    v.terminer()


@parcours("formateur-du-jour", "Un formateur du jour reçoit l'avis d'une absence, avec le motif", role="formateur", budget=BUDGET_MESSAGES,
          navigations=NOUVELLE, banc={"formateur_du_jour": "1"})
def formateur_du_jour(v):
    """Messages : l'absence arrive en copie (rien « À traiter ») ; le suivi montre le jour et le motif, sans geste de prise en compte."""
    v.aller("Messages")
    ligne = '#view li.demande-ligne:has-text("Absence jeudi matin")'
    v.attendre(ligne, "l'avis de l'absence")
    v.but("Messages ouverts, l'avis est là")
    v.attendre('#view p:text-is("Rien à traiter.")', "« Rien à traiter. » : une copie n'est pas une demande à traiter")
    v.attendre('#view h3:text-is("Ouvertes (1)")', "« Ouvertes (1) »")
    v.toucher(ligne + " a.demande-lien", "l'absence", compte=False)
    v.attendre(PAGE_DEMANDE + ' .demande-absence dd:text-is("Santé")', "le motif, visible du formateur du jour")
    v.attendre(PAGE_DEMANDE + ' .demande-absence dd:has-text("29 octobre, matin")', "le jour et le moment")
    v.attendre(PAGE_DEMANDE + ' .demande-destinataires li:has-text("Denis Exemple")', "le formateur du jour parmi les destinataires")
    if v.voit(PAGE_DEMANDE + ' button:text-is("Pris en compte")') or v.voit(PAGE_DEMANDE + " .demande-toutes-faites"):
        v.constat("E", BLOQUE, "le formateur du jour a le geste du destinataire principal (prise en compte ou réponse toute faite)")
    v.terminer()


@parcours("delegue", "Un délégué voit l'absence d'un camarade : le nom et les jours, jamais le motif", role="stagiaire", budget=BUDGET_CONTACTS,
          navigations=NOUVELLE, banc={"delegue": "1"})
def delegue(v):
    """Contacts : « Absences annoncées dans ta promo » dit le nom et le jour, sans lien, sans motif ni mot ; « Mes demandes » reste vide."""
    v.aller("Contacts")
    section = PAGE + " .contact-promo"
    v.attendre(PAGE + ' h3:text-is("Absences annoncées dans ta promo")', "« Absences annoncées dans ta promo »")
    v.attendre(section + ' .contact-promo-ligne:has-text("Agathe O.")', "le nom du camarade")
    v.but("page Contacts du délégué ouverte")
    ligne = v.texte(section + " .contact-promo-ligne")
    if "29 octobre" not in ligne:
        v.constat("F", BLOQUE, "le jour de l'absence manque dans la ligne du délégué")
    page = v.texte("#view")
    for interdit in ("Santé", "médical", "Rendez-vous", "Absence jeudi matin"):
        if interdit in page:
            v.constat("F", BLOQUE, "le délégué voit un détail de l'absence (%s)" % interdit, capture=True)
    if v.page.locator(section + " a").count() or v.page.locator('#view a[href*="contacts/null"]').count():
        v.constat("F", BLOQUE, "la ligne du délégué est un lien (il n'y a rien à ouvrir)")
    v.attendre(PAGE + ' p:text-is("Tu n\'as encore rien envoyé au centre.")', "« Mes demandes » vide")
    v.terminer()


def jour_du_planning(v, abrege):
    """Sur téléphone, le planning montre un jour à la fois : on touche le jour voulu (LUN, JEU) ; sur ordinateur, toute la semaine est là."""
    if v.telephone:
        v.toucher('.daystrip button[role="tab"]:has-text("%s")' % abrege, "le jour « %s »" % abrege)


@parcours("absence-planning", "Le planning marque « absent, prévenu » une absence annoncée (vue de l'équipe)", role="formateur",
          budget={"ordinateur": 1, "telephone": 3}, navigations=NOUVELLE, banc={"absence_planning": "1"}, depart="#/home")
def absence_planning_equipe(v):
    """Planning de la semaine : « absent, prévenu » derrière le nom d'une absence de la journée, « absent de 10 h à 11 h » pour des heures."""
    v.aller("Planning")
    jour_du_planning(v, "jeu")
    v.attendre('#view :text("absent, prévenu")', "« absent, prévenu » sur une carte")
    jour_du_planning(v, "lun")
    v.attendre('#view :text("absent de 10 h à 11 h")', "« absent de 10 h à 11 h » sur une carte")
    v.but("planning ouvert")
    v.terminer()


@parcours("absence-planning-stagiaire", "Le planning marque « absent » une absence annoncée, sans « prévenu » (vue du stagiaire)", role="stagiaire",
          budget={"ordinateur": 1, "telephone": 3}, navigations=NOUVELLE, banc={"absence_planning": "1"}, depart="#/home")
def absence_planning_stagiaire(v):
    """Planning : « absent » derrière le nom, jamais « prévenu » ni un motif."""
    v.aller("Planning")
    jour_du_planning(v, "jeu")
    v.attendre('#view :text("(absent)")', "« (absent) » derrière un nom")
    pages = [v.texte("#view")]
    jour_du_planning(v, "lun")
    v.attendre('#view :text("Agathe O. (absent)")', "« Agathe O. (absent) » le lundi matin (des heures, dites seulement « absent »)")
    v.but("planning ouvert")
    pages.append(v.texte("#view"))
    for interdit in ("prévenu", "absent de 10"):
        if any(interdit in page for page in pages):
            v.constat("F", BLOQUE, "le planning du stagiaire en dit trop (%s)" % interdit, capture=True)
    v.terminer()


@parcours("absence-emargement", "La feuille du jour pré-marque « Absent (prévenu) » une absence annoncée", role="formateur",
          budget={"ordinateur": 2, "telephone": 3}, navigations=NOUVELLE, banc={"absence": "annoncee"})
def absence_emargement(v):
    """Émargement du matin : la ligne de la stagiaire qui a prévenu dit « Absent (prévenu) » ; la mention « Absence prévenue » n'est pas répétée."""
    v.aller("Émargement")
    v.toucher('#view a[href="#/emargement/2026-10-28/matin"]', "la feuille de ce matin")
    v.attendre('#view :text("Absent (prévenu)")', "« Absent (prévenu) » sur la ligne de la stagiaire")
    v.but("feuille du matin affichée")
    if "Absence prévenue" in v.texte("#view"):
        v.constat("F", BLOQUE, "« Absence prévenue » est répété à côté de « Absent (prévenu) »")
    v.terminer()


@parcours("absence-annulee", "Un stagiaire annule son absence", role="stagiaire", budget={"ordinateur": 4, "telephone": 5},
          navigations=NOUVELLE, banc={"ecritures": "1", "justificatif": "1"})
def absence_annulee(v):
    """« Mes demandes » : l'absence du jeudi, « Annuler », la fenêtre de l'app, « Annuler l'absence » : l'étape « Annulée » remplace le geste."""
    v.aller("Contacts")
    v.attendre(PAGE + ' h3:text-is("Mes demandes")', "« Mes demandes »")
    v.toucher(PAGE + " li.demande-ligne a.demande-lien", "l'absence, dans « Mes demandes »")
    v.attendre(PAGE_DEMANDE + " .demande-absence", "la section « Absence »")
    v.toucher(PAGE_DEMANDE + ' button:text-is("Annuler")', "« Annuler »")
    v.attendre('.confirmer-fond :text("Annuler cette absence ?")', "la question, dans une fenêtre de l'app")
    v.but("la question d'annulation est posée")
    v.ecouter_messages()
    v.toucher('.confirmer-fond button:text-is("Annuler l\'absence")', "« Annuler l'absence »", compte=False, ecriture=True)
    v.exiger_confirmation("l'annulation", "Absence annulée")
    v.attendre(PAGE_DEMANDE + ' .demande-etape-nom:text-is("Annulée")', "l'étape « Annulée »")
    if v.voit(PAGE_DEMANDE + ' button:text-is("Annuler")'):
        v.constat("E", BLOQUE, "« Annuler » reste proposé après l'annulation")
    v.terminer()
