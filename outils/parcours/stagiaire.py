# -*- coding: utf-8 -*-
"""Parcours du stagiaire : les tâches de tous les jours, jouées comme le ferait un stagiaire.

En fin de fichier, les pages refaites par le lot 2B (Accueil, planning en grille, sous-onglet QCM, Livret EPCF) :
elles n'existent que sous la nouvelle navigation.
"""
import json

from . import parcours
from .navigation import texte, SOUS_ONGLET, RETOUR
from .visite import BLOQUE, LISTE

# Le cours du thème 22 tel que le banc le sert : le faux Supabase n'a que son titre. Un cours court au gabarit
# des vrais (fiche synthèse, sous-parties, tableau des sanctions, planche de panneaux), pour que le lecteur ait
# de quoi s'afficher comme en ligne. Les valeurs servent seulement à remplir la page du banc.
COURS_DU_BANC = """# THÈME 22 - Feux du véhicule

> **L'essentiel en 6 lignes**
> Les feux servent à voir et à être vu.
> Les feux de croisement s'allument de nuit et par mauvaise visibilité.
> Les feux de route éclairent loin et éblouissent : on les coupe en croisant.
> Les feux de brouillard avant s'utilisent par brouillard ou forte pluie.
> Le feu de brouillard arrière exige un brouillard ou une chute de neige.
> Un feu défaillant se remplace sans attendre.

## 1. Définition / Introduction

Un véhicule porte des feux d'éclairage, qui éclairent la route, et des feux de signalisation, qui le rendent visible.

## 2. Contenu du cours

### A. Les feux d'éclairage

Les feux de croisement éclairent la route sans éblouir. Les feux de route éclairent plus loin et se coupent dès qu'un autre usager approche.

_Textes : R416-4_

### B. Les feux de signalisation

Les feux de position signalent la présence et la largeur du véhicule. Les feux stop s'allument au freinage.

:::signaux AB6 AB7
Le losange jaune et sa levée.
:::

## 3. Risques / Comportements / Sanctions

**SANCTIONS**

| Infraction | Article | Amende | Retrait points | Source |
|------------|---------|--------|----------------|--------|
| Circuler sans éclairage de nuit | R416-4 | 135 euros | aucun | Légifrance |

## 4. Points clés à retenir

- Voir et être vu.
- Couper les feux de route en croisant.

## 6. Aide-mémoire

| Situation | Feux |
|---|---|
| Nuit, route éclairée | croisement |
| Nuit, route sombre, personne en face | route |
| Brouillard | brouillard avant, et arrière si visibilité réduite |
"""
SEMIS_COURS = ("FIXTURES.cours.forEach((c) => { if (c.numero === 22) c.corps_md = %s; });" % json.dumps(COURS_DU_BANC),)


def dessiner_signature(v, canvas):
    """Une signature en zigzag sur toute la largeur du cadre (une signature trop courte est refusée)."""
    boite = v.attendre(canvas, "la zone de signature").bounding_box()
    x0, y0, l, h = boite["x"], boite["y"], boite["width"], boite["height"]
    souris = v.page.mouse
    souris.move(x0 + l * 0.08, y0 + h * 0.6)
    souris.down()
    for i in range(1, 13):
        souris.move(x0 + l * (0.08 + 0.07 * i), y0 + h * (0.3 if i % 2 else 0.7), steps=4)
    souris.up()


@parcours("lire-un-cours", "Lire le cours d'un thème", role="stagiaire", budget=2, semis=SEMIS_COURS)
def lire_un_cours(v):
    """Ouvrir Cours et QCM, puis le cours d'un thème ; le lecteur affiche le cours et se referme."""
    v.aller("Cours et QCM")
    v.etape("ouvrir le cours du thème « Feux du véhicule »")
    v.toucher("button.theme-cours-btn", "le bouton « Cours » du thème")
    lecteur = v.attendre(".cours-overlay", "le lecteur de cours")
    if len(lecteur.inner_text().strip()) < 200:
        v.echec("le lecteur de cours est presque vide")
    v.but("cours affiché")
    v.etape("refermer le cours")
    if v.telephone:
        v.toucher("button.cours-close", "« Fermer le cours »", compte=False)
    else:
        v.fermer_par_echap(".cours-overlay", "le lecteur de cours")
        if v.voit(".cours-overlay"):
            v.toucher("button.cours-close", "« Fermer le cours »", compte=False)
    if v.voit(".cours-overlay"):
        v.constat("D", BLOQUE, "le lecteur de cours ne se referme pas", capture=True)
    v.terminer()


@parcours("passer-un-qcm", "S'entraîner sur un QCM jusqu'à sa note", role="stagiaire", budget=3)
def passer_un_qcm(v):
    """Ouvrir le QCM d'un thème, s'entraîner, répondre à toutes les questions et lire sa note."""
    v.aller("Cours et QCM")
    v.etape("ouvrir le QCM du thème")
    v.toucher("button.theme-qcm-hint", "le bouton « QCM » du thème")
    v.toucher(texte("S'entraîner", "button"), "« S'entraîner »")
    v.attendre("button.qcm-choice", "la première question")
    v.but("première question affichée")
    for n in range(1, 41):
        if v.voit(".qcm-score-big"):
            break
        v.etape("question %d" % n)
        v.toucher("button.qcm-choice:not(.disabled)", "une réponse")
        v.toucher("button.qcm-next:visible", "« Valider »")
        v.toucher("button.qcm-next:visible", "« Question suivante » ou « Voir le résultat »")
    note = v.attendre(".qcm-score-big", "la note du QCM").inner_text()
    v.etape("note affichée : %s" % note.strip())
    v.controler_ecran("résultat du QCM")
    if v.telephone:
        v.toucher("button.qcm-close", "« Fermer »", compte=False)
    else:
        v.fermer_par_echap("button.qcm-close", "le QCM")
        if v.voit("button.qcm-close"):
            v.toucher("button.qcm-close", "« Fermer »", compte=False)
    v.terminer()


# Évolution d'abord : c'est le but (« mes résultats ») ; les autres parties sont visitées ensuite, hors budget.
PARTIES_MON_SUIVI = ("Évolution", "Passages", "EPCF", "Livret", "Dossier pro")
# Nouvelle navigation (lot 2B) : Évolution et La classe sont les deux vues de Résultats, qui s'ouvre sur « Moi » ; le livret
# s'y appelle « Livret EPCF » (décision de Timy du 08/11).
PARTIES_MON_SUIVI_V2 = ("Résultats", "Passages", "EPCF", "Livret EPCF", "Dossier pro")


@parcours("mon-suivi", "Voir mes résultats et mes passages (Mon suivi)", role="stagiaire", budget=2)
def mon_suivi(v):
    """Ouvrir Mon suivi, puis chacune de ses parties : chacune s'affiche sans défaut."""
    v.aller("Mon suivi")
    parties = PARTIES_MON_SUIVI_V2 if v.navigation == "nouvelle" else PARTIES_MON_SUIVI
    for i, partie in enumerate(parties):
        v.etape("partie « %s »" % partie)
        if i and v.telephone:
            # Sur téléphone, chaque partie est une page : on revient au sommaire par son lien de retour (hors budget).
            v.toucher(RETOUR, "le lien de retour vers le sommaire", compte=False)
        v.toucher(texte(partie, SOUS_ONGLET), "« %s »" % partie)
        but = partie in ("Évolution", "Résultats")
        v.attendre("#view .ms-section-title:has-text(\"volution\")" if but else "#view :is(h2, h3, table, .card)",
                   "le contenu de « %s »" % partie)
        if but:
            v.but("résultats affichés")
        v.controler_ecran("Mon suivi, " + partie)
    v.terminer()


# Téléphone, nouvelle navigation : Mon suivi, la ligne Résultats du sommaire, puis « La classe » (3, règle générale
# du référentiel : toute tâche courante en 3 clics au plus) ; ancienne navigation : l'onglet Notes, en 1.
@parcours("notes-de-la-classe", "Voir les notes de la classe", role="stagiaire", budget={"ordinateur": 2, "telephone": 3})
def notes_de_la_classe(v):
    """Ouvrir les notes de la classe (onglet Notes, ou Mon suivi, La classe)."""
    v.aller("La classe")
    v.attendre("#view :is(table, .notes-chart-svg-wrap, .matrice-wrap, .card)", "les notes de la classe")
    v.but("notes de la classe affichées")
    v.terminer()


@parcours("ccp2", "Avancer mon CCP2", role="stagiaire", budget=1)
def ccp2(v):
    """Ouvrir CCP2 : le parcours en étapes est là."""
    v.aller("CCP2")
    v.attendre("#view h2, #view h1", "le titre de la page CCP2")
    if "étape" not in v.texte("#view").lower():
        v.echec("la page CCP2 ne montre aucune étape")
    v.but("parcours CCP2 affiché")
    v.verifier_precedent("#/planning", "CCP2")
    v.terminer()


@parcours("page-en-panne", "Ouvrir une page quand la connexion lâche", role="stagiaire", budget=1)
def page_en_panne(v):
    """Les lectures échouent : la page le dit et propose « Réessayer » ; la connexion revenue, « Réessayer » affiche la page."""
    v.panne("network error")
    avant = v.messages_visibles()
    v.aller("Cours et QCM")
    # Une lecture en panne relève du critère J (« un message et Réessayer », listé) ; un refus d'action, du E.
    v.exiger_message("ouvrir Cours et QCM sans connexion", avant, critere="J", gravite=LISTE)
    v.but("message de panne affiché")
    v.retablir()
    reessayer = texte("Réessayer", "button")
    if not v.voit(reessayer):
        v.constat("J", LISTE, "la page en panne ne propose pas « Réessayer »", capture=True)
        v.terminer()
        return
    v.toucher(reessayer, "« Réessayer »")
    v.attendre("button.theme-cours-btn, button.theme-qcm-hint", "la liste des thèmes après « Réessayer »")
    v.terminer()


@parcours("documents-et-contacts", "Trouver un document ou les contacts du centre", role="stagiaire", budget=2)
def documents(v):
    """Ouvrir les documents (Ressources, ou Cours et QCM, Documents) : des liens et les contacts du centre."""
    v.aller("Documents")
    v.attendre("#view a[href^=\"http\"], #view a[href$=\".pdf\"]", "un document ou un lien officiel")
    if "contact" not in v.texte("#view").lower():
        v.constat("F", LISTE, "la page des documents ne montre pas les contacts du centre")
    v.but("documents affichés")
    v.terminer()


@parcours("signaler-un-probleme", "Signaler un problème", role="stagiaire", budget=2)
def signaler(v):
    """Ouvrir « Signaler un problème », écrire, envoyer : un remerciement confirme l'envoi."""
    v.aller("Signaler un problème")
    v.attendre("#sg-message", "le champ du signalement")
    v.but("formulaire ouvert")
    v.remplir("#sg-message", "Essai du robot : la page se lit mal sur mon téléphone.", "le champ du signalement")
    v.ecouter_messages()
    v.toucher("button.sg-envoyer", "« Envoyer »", ecriture=True)
    if not v.exiger_confirmation("l'envoi", "merci"):
        v.echec("après l'envoi, aucun message ne confirme")
    v.terminer()


@parcours("signaler-un-probleme-en-panne", "Signaler un problème quand l'envoi échoue", role="stagiaire", budget=2)
def signaler_en_panne(v):
    """L'envoi échoue (réseau coupé) : un message le dit, le texte écrit n'est pas perdu."""
    v.aller("Signaler un problème")
    v.attendre("#sg-message", "le champ du signalement")
    v.but("formulaire ouvert")
    v.remplir("#sg-message", "Essai du robot : envoi en panne.", "le champ du signalement")
    v.page.evaluate("() => { window.__HARNESS_SIGNALER_FAIL = 'réseau coupé'; }")
    avant = v.messages_visibles()
    v.toucher("button.sg-envoyer", "« Envoyer »", ecriture=True)
    v.exiger_message("l'envoi d'un signalement en panne", avant)
    v.page.evaluate("() => { window.__HARNESS_SIGNALER_FAIL = null; }")
    if not v.voit("#sg-message"):
        # La fenêtre s'est refermée : le texte doit revenir quand on la rouvre.
        v.etape("rouvrir la fenêtre après l'échec")
        v.aller("Signaler un problème")
    if "Essai du robot" not in v.attendre("#sg-message", "le champ du signalement").input_value():
        v.constat("E", BLOQUE, "le texte du signalement est perdu après l'échec de l'envoi", capture=True)
    v.etape("refermer la fenêtre")
    v.fermer_par_echap("#sg-message", "la fenêtre « Signaler un problème »")
    if v.voit("#sg-message"):
        v.toucher(texte("Fermer", "button"), "« Fermer »", compte=False)
    v.terminer()


@parcours("mes-preferences", "Masquer mes notes aux autres (Mes préférences)", role="stagiaire", budget=2)
def preferences(v):
    """Ouvrir les préférences et trouver le réglage de l'anonymat des notes."""
    v.aller("Mes préférences")
    v.attendre("#view input[type=checkbox]", "une case de réglage")
    if "note" not in v.texte("#view").lower():
        v.echec("aucun réglage des notes sur la page des préférences")
    v.but("réglage de l'anonymat trouvé")
    v.terminer()


@parcours("signer-l-emargement", "Signer l'émargement du matin", role="stagiaire", budget=1)
def signer(v):
    """Toucher « Signer » dans le bandeau, signer du doigt, valider : le bandeau confirme."""
    v.etape("toucher « Signer » dans le bandeau")
    v.toucher("#emargement-bandeau button:has-text(\"Signer\")", "« Signer » (bandeau d'émargement)")
    v.attendre(".sig-modal", "la fenêtre de signature")
    v.but("fenêtre de signature ouverte")
    v.etape("signer et valider")
    dessiner_signature(v, "canvas.sig-canvas")
    v.toucher(".sig-modal button.btn.primary", "« Valider ma signature »", ecriture=True)
    v.attendre("#emargement-bandeau:has-text(\"signé\")", "la confirmation dans le bandeau")
    if v.voit(".sig-modal"):
        v.constat("D", BLOQUE, "la fenêtre de signature reste ouverte après la signature", capture=True)
    v.terminer()


# --- Pages refaites par le lot 2B (nouvelle navigation seulement) ------------------------------------------
NOUVELLE = ("nouvelle",)


def fermer_la_fiche_du_qcm(v):
    """Referme ce qui reste ouvert d'un QCM (écran de l'examen, fiche du thème) par ses boutons, hors budget."""
    for _ in range(3):
        if v.voit("button.qcm-close"):
            v.toucher("button.qcm-close", "« Fermer » (QCM)", compte=False)
        elif v.voit(".theme-modal .modal-actions button:has-text(\"Fermer\")"):
            v.toucher(".theme-modal .modal-actions button:has-text(\"Fermer\")", "« Fermer » (fiche du QCM)", compte=False)
        else:
            return


@parcours("ma-journee", "Voir ma journée (Accueil)", role="stagiaire", budget=1, navigations=NOUVELLE)
def ma_journee(v):
    """Ouvrir l'Accueil : la journée (matin et après-midi), « À faire » et le prochain rendez-vous sont là."""
    v.aller("Accueil")
    v.attendre("#view .acc-journee .acc-creneau", "la journée (matin et après-midi)")
    v.but("journée affichée")
    page = v.texte("#view")
    for titre in ("À faire", "Prochain rendez-vous"):
        if titre not in page:
            v.constat("F", LISTE, "l'Accueil ne montre pas « %s »" % titre, capture=True)
    v.terminer()


@parcours("signer-depuis-l-accueil", "Signer l'émargement depuis l'Accueil", role="stagiaire", budget=1,
          navigations=NOUVELLE, depart="#/home")
def signer_depuis_l_accueil(v):
    """Sur l'Accueil, « Signer pour ce matin », signer du doigt, valider : la journée dit « Signé à »."""
    v.etape("toucher « Signer pour ce matin »")
    v.toucher(texte("Signer pour ce matin", "#view button"), "« Signer pour ce matin »")
    v.attendre(".sig-modal", "la fenêtre de signature")
    v.but("fenêtre de signature ouverte")
    v.etape("signer et valider")
    dessiner_signature(v, "canvas.sig-canvas")
    v.toucher(".sig-modal button.btn.primary", "« Valider ma signature »", ecriture=True)
    v.attendre("#view .acc-signe", "« Signé à » dans la journée")
    if v.voit(".sig-modal"):
        v.constat("D", BLOQUE, "la fenêtre de signature reste ouverte après la signature", capture=True)
    if v.voit(texte("Signer pour ce matin", "#view button")):
        v.constat("E", LISTE, "« Signer pour ce matin » reste proposé après la signature", capture=True)
    v.terminer()


@parcours("examen-depuis-l-accueil", "Passer l'examen ouvert, depuis « À faire » de l'Accueil", role="stagiaire",
          budget=3, navigations=NOUVELLE, depart="#/home")
def examen_depuis_l_accueil(v):
    """L'app s'ouvre sur l'Accueil : la ligne « Examen ouvert » mène à l'écran « Prêt pour l'examen ? » en 3 touchers au plus."""
    v.etape("toucher la ligne « Examen ouvert »")
    ligne = v.attendre("#view a.acc-ligne:has-text(\"Examen ouvert\")", "la ligne « Examen ouvert » de « À faire »")
    theme = ligne.inner_text().strip().splitlines()[0].split(":", 1)[-1].strip().replace('"', "")
    v.toucher(ligne, "la ligne « Examen ouvert »")
    examen = texte("Passer l'examen", "button")
    if not v.voit(examen):
        rangee = "#view .theme-row:has-text(\"%s\") button.theme-qcm-hint" % theme
        sous_onglet = "#view .acc-ligne:has-text(\"%s\") button:has-text(\"Ouvrir\")" % theme
        if v.voit(rangee):
            # Un raccourci mène au même endroit que son nom (critère C) : ici, la liste de tous les thèmes.
            v.constat("C", LISTE, "« Examen ouvert : %s » mène à la liste des thèmes, pas au QCM du thème" % theme, capture=True)
            v.toucher(rangee, "le bouton « QCM » du thème %s" % theme)
        elif v.voit(sous_onglet):
            v.toucher(sous_onglet, "« Ouvrir » (QCM du thème %s)" % theme)
        else:
            v.echec("après « Examen ouvert », ni la fiche du QCM ni le thème %s à l'écran" % theme)
    v.toucher(examen, "« Passer l'examen »")
    v.attendre(texte("Commencer l'examen", "button"), "l'écran « Prêt pour l'examen ? »")
    v.but("examen prêt à commencer")
    v.etape("ne pas commencer : « Annuler »")
    v.toucher(texte("Annuler", "button"), "« Annuler »", compte=False)
    fermer_la_fiche_du_qcm(v)
    v.terminer()


@parcours("mes-qcm", "Retrouver mes QCM et ma dernière note (sous-onglet QCM)", role="stagiaire", budget=2,
          navigations=NOUVELLE)
def mes_qcm(v):
    """Cours et QCM, sous-onglet QCM : chaque QCM avec sa dernière note ; « Ouvrir » mène à sa fiche."""
    v.aller("QCM")
    v.attendre("#view .acc-ligne:has-text(\"Thème\")", "la liste de mes QCM")
    v.but("liste des QCM affichée")
    v.etape("ouvrir la fiche du premier QCM")
    v.toucher(texte("Ouvrir", "#view button"), "« Ouvrir » (premier QCM)")
    v.attendre(texte("S'entraîner", "button"), "la fiche du QCM")
    v.controler_ecran("fiche du QCM")
    fermer_la_fiche_du_qcm(v)
    v.terminer()


@parcours("livret-epcf", "Ouvrir mon livret EPCF (Mon suivi)", role="stagiaire", budget=2, navigations=NOUVELLE)
def livret_epcf(v):
    """Mon suivi, Livret EPCF (sous-onglet sur ordinateur, ligne du sommaire sur téléphone) : le livret s'affiche."""
    v.aller("Livret EPCF")
    v.attendre("#view h3:has-text(\"Livret EPCF\")", "le livret EPCF")
    v.but("livret affiché")
    v.terminer()


@parcours("planning-de-demain", "Voir mon planning de demain", role="stagiaire", budget=2, navigations=NOUVELLE,
          depart="#/home")
def planning_de_demain(v):
    """Planning en grille : demain (jeudi 29) se lit dans sa colonne sur ordinateur, se touche dans la bande des jours
    sur téléphone. Puis « Liste », gardée au rechargement, et retour à la grille."""
    v.aller("Planning")
    if v.telephone:
        v.attendre(".daystrip [role=tab][aria-selected=true]", "la bande des jours, aujourd'hui choisi")
        v.toucher(".daystrip [role=tab]:has-text(\"29\")", "le jour de demain (jeudi 29)")
        v.attendre(".wtel [role=tabpanel] h3:has-text(\"29\")", "la journée de demain")
    else:
        v.attendre(".wgrid .wg-day:has-text(\"29\")", "la colonne de demain dans la grille")
    v.but("planning de demain affiché")
    v.etape("passer en « Liste »")
    v.toucher(".vue-toggle button[data-vue=liste]", "« Liste »", compte=False)
    v.attendre("#view .p-day-card", "la semaine en liste")
    v.etape("recharger la page")
    v.page.reload(wait_until="load")
    v.attendre(".vue-toggle", "le planning après le rechargement", delai=8000)
    v.page.wait_for_timeout(500)
    if not v.voit("#view .p-day-card"):
        v.constat("E", LISTE, "le choix « Liste » n'est pas gardé au rechargement", capture=True)
    v.etape("revenir à la grille")
    v.toucher(".vue-toggle button[data-vue=grille]", "« Grille »", compte=False)
    v.attendre(".wsem", "la grille de la semaine")
    v.terminer()
