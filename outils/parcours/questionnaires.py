# -*- coding: utf-8 -*-
"""Parcours des questionnaires anonymes (Qualiopi Q3) : le stagiaire répond au questionnaire de fin de formation.

Le faux Supabase simule les fonctions de la migration des questionnaires (`_harness_supabase.js`, section
« Questionnaires anonymes ») : jour de la base au 05/12/2026, dans la fenêtre de la promo 1 (fin le 11/12/2026). La
réponse est une écriture : elle n'est jamais rejouée (un second envoi serait refusé, « Tu as déjà répondu »).
"""
from . import parcours
from .visite import BLOQUE

FENETRE = ".questionnaire-fenetre"
SUIVANT = FENETRE + " .qn-actions .qn-suivant"


@parcours("repondre-au-questionnaire", "Répondre au questionnaire de fin de formation", role="stagiaire", budget=3,
          banc={"questionnaires_jour": "2026-12-05"})
def repondre_au_questionnaire(v):
    """Depuis l'Accueil, « Répondre » dans le bandeau, une question par écran, « Envoyer » : le merci s'affiche et le
    bandeau disparaît."""
    v.aller("Accueil")
    v.attendre(".questionnaire-bandeau", "le bandeau « Ton avis sur la formation »")
    v.etape("ouvrir le questionnaire")
    v.toucher(".questionnaire-bandeau button.btn.primary", "« Répondre »")
    v.attendre(FENETRE, "la fenêtre du questionnaire")
    v.toucher(SUIVANT, "« Commencer »")
    v.attendre(FENETRE + " .qn-progression-texte", "la première question")
    v.but("première question affichée")
    for n in range(1, 21):
        v.etape("question %d" % n)
        if v.voit(FENETRE + " .qn-commentaire"):
            v.remplir(FENETRE + " .qn-commentaire", "Essai du robot : rien de nominatif.", "le commentaire")
        elif not v.voit(FENETRE + " .qn-facultative"):
            # « Plutôt oui » (3e choix) : une réponse à l'échelle comme à une question à choix.
            v.toucher(FENETRE + " .qn-option:nth-child(3)", "une réponse")
        if v.texte(SUIVANT).strip().startswith("Envoyer"):
            v.toucher(SUIVANT, "« Envoyer »", ecriture=True)
            break
        v.toucher(SUIVANT, "« Suivant »")
    else:
        v.echec("pas de bouton « Envoyer » après 20 écrans")
    merci = v.attendre(FENETRE + " .qn-merci", "le merci après l'envoi", delai=4000).inner_text()
    if "sans ton nom" not in merci:
        v.echec("après l'envoi, le merci ne dit pas que la réponse est anonyme : « %s »" % merci.strip()[:80])
    v.controler_ecran("merci du questionnaire")
    v.etape("refermer la fenêtre")
    v.toucher(SUIVANT, "« Fermer »", compte=False)
    if v.voit(FENETRE):
        v.constat("D", BLOQUE, "la fenêtre du questionnaire reste ouverte après « Fermer »", capture=True)
    if v.voit(".questionnaire-bandeau"):
        v.constat("E", BLOQUE, "le bandeau du questionnaire reste affiché après la réponse", capture=True)
    v.terminer()
