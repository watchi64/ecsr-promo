# -*- coding: utf-8 -*-
"""Parcours du stagiaire : les tâches de tous les jours, jouées comme le ferait un stagiaire.

Les parcours des pages refaites par le lot 2B (Accueil du stagiaire, planning en grille, sous-onglets QCM)
s'ajouteront ici après sa fusion.
"""
import json

from . import parcours
from .navigation import texte, SOUS_ONGLET, RETOUR

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
        v.constat("D", "bloque", "le lecteur de cours ne se referme pas", capture=True)
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


@parcours("mon-suivi", "Voir mes résultats et mes passages (Mon suivi)", role="stagiaire", budget=2)
def mon_suivi(v):
    """Ouvrir Mon suivi, puis chacune de ses parties : chacune s'affiche sans défaut."""
    v.aller("Mon suivi")
    for i, partie in enumerate(PARTIES_MON_SUIVI):
        v.etape("partie « %s »" % partie)
        if i and v.telephone:
            # Sur téléphone, chaque partie est une page : on revient au sommaire par son lien de retour (hors budget).
            v.toucher(RETOUR, "le lien de retour vers le sommaire", compte=False)
        v.toucher(texte(partie, SOUS_ONGLET), "« %s »" % partie)
        if partie == "Évolution":
            v.but("résultats affichés")
        v.controler_ecran("Mon suivi, " + partie)
    v.terminer()


@parcours("notes-de-la-classe", "Voir les notes de la classe", role="stagiaire", budget=2)
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
    v.aller("Cours et QCM")
    v.exiger_message("ouvrir Cours et QCM sans connexion")
    v.but("message de panne affiché")
    v.retablir()
    reessayer = texte("Réessayer", "button")
    if not v.voit(reessayer):
        v.constat("J", "liste", "la page en panne ne propose pas « Réessayer »", capture=True)
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
        v.constat("F", "liste", "la page des documents ne montre pas les contacts du centre")
    v.but("documents affichés")
    v.terminer()


@parcours("signaler-un-probleme", "Signaler un problème", role="stagiaire", budget=2)
def signaler(v):
    """Ouvrir « Signaler un problème », écrire, envoyer : un remerciement confirme l'envoi."""
    v.aller("Signaler un problème")
    v.attendre("#sg-message", "le champ du signalement")
    v.but("formulaire ouvert")
    v.remplir("#sg-message", "Essai du robot : la page se lit mal sur mon téléphone.", "le champ du signalement")
    v.toucher("button.sg-envoyer", "« Envoyer »")
    v.attendre("#toast:not(.hidden)", "la confirmation de l'envoi", delai=4000)
    v.terminer()


@parcours("signaler-un-probleme-en-panne", "Signaler un problème quand l'envoi échoue", role="stagiaire", budget=2)
def signaler_en_panne(v):
    """L'envoi échoue (réseau coupé) : un message le dit, le texte écrit n'est pas perdu."""
    v.aller("Signaler un problème")
    v.attendre("#sg-message", "le champ du signalement")
    v.but("formulaire ouvert")
    v.remplir("#sg-message", "Essai du robot : envoi en panne.", "le champ du signalement")
    v.page.evaluate("() => { window.__HARNESS_SIGNALER_FAIL = 'réseau coupé'; }")
    v.toucher("button.sg-envoyer", "« Envoyer »")
    v.exiger_message("l'envoi d'un signalement en panne")
    if v.voit("#sg-message") and "Essai du robot" not in v.page.locator("#sg-message").input_value():
        v.constat("E", "bloque", "le texte du signalement est perdu après l'échec de l'envoi", capture=True)
    v.page.evaluate("() => { window.__HARNESS_SIGNALER_FAIL = null; }")
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
    v.toucher(".sig-modal button.btn.primary", "« Valider ma signature »")
    v.attendre("#emargement-bandeau:has-text(\"signé\")", "la confirmation dans le bandeau")
    if v.voit(".sig-modal"):
        v.constat("D", "bloque", "la fenêtre de signature reste ouverte après la signature", capture=True)
    v.terminer()
