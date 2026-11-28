# -*- coding: utf-8 -*-
"""Parcours de la porte de connexion (retouche du 27/11/2026, variante D) : se connecter, et demander un lien quand le mot
de passe est oublié. Ils commencent déconnectés (`?role=anon`), sur la porte, comme une personne qui ouvre l'app le matin.
"""
from . import parcours
from .navigation import SELECTEUR_BARRE
from .visite import BLOQUE

PHRASE_LIEN_PARTI = "Si un compte existe pour cette adresse, un lien vient de partir."


@parcours("se-connecter", "Se connecter avec son adresse e-mail et son mot de passe", role="stagiaire", budget=1,
          banc={"role": "anon"}, ouverture="porte")
def se_connecter(v):
    """Adresse, mot de passe (vérifié avec « Afficher »), « Se connecter » : l'app s'ouvre sur sa barre de navigation."""
    v.remplir("#gate-email", "camille.martin@exemple.fr", "le champ « Adresse e-mail »")
    v.remplir("#gate-password", "mot-de-passe-du-banc", "le champ « Mot de passe »")
    v.etape("vérifier le mot de passe saisi")
    v.toucher("#gate-afficher", "« Afficher »", compte=False)
    if v.page.locator("#gate-password").get_attribute("type") != "text":
        v.constat("E", BLOQUE, "« Afficher » ne montre pas le mot de passe", capture=True)
    v.toucher("#gate-afficher", "« Masquer »", compte=False)
    if v.page.locator("#gate-password").get_attribute("type") != "password":
        v.constat("E", BLOQUE, "« Masquer » ne cache pas le mot de passe", capture=True)
    v.toucher("#gate-submit", "« Se connecter »", ecriture=True)
    v.attendre(SELECTEUR_BARRE, "la barre de navigation de l'app", delai=10000)
    v.but("app ouverte")
    v.terminer()


@parcours("mot-de-passe-oublie", "Demander un lien quand le mot de passe est oublié", role="stagiaire", budget=2,
          banc={"role": "anon"}, ouverture="porte")
def mot_de_passe_oublie(v):
    """« Mot de passe oublié ? », l'adresse, « Envoyer le lien » : la porte dit que le lien est parti (sans dire si le compte
    existe) ; « Retour à la connexion » rend les onglets et le champ du mot de passe."""
    v.toucher("#gate-oubli", "« Mot de passe oublié ? »")
    v.attendre('#gate-titre:text-is("Mot de passe oublié")', "le titre « Mot de passe oublié »")
    v.remplir("#gate-email", "camille.martin@exemple.fr", "le champ « Adresse e-mail »")
    v.toucher("#gate-submit", "« Envoyer le lien »", ecriture=True)
    v.attendre('#gate-info:has-text("%s")' % PHRASE_LIEN_PARTI, "la phrase « un lien vient de partir »", delai=8000)
    v.but("lien demandé")
    v.toucher("#gate-retour", "« Retour à la connexion »", compte=False)
    v.attendre("#gate-tab-signin", "l'onglet « Connexion »")
    if not v.voit("#gate-password"):
        v.constat("E", BLOQUE, "le retour à la connexion ne rend pas le champ du mot de passe", capture=True)
    v.terminer()
