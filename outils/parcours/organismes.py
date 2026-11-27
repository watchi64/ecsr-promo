# -*- coding: utf-8 -*-
"""Parcours du cloisonnement par organisme (spec 2026-11-27, étape 3 de l'app).

Le faux Supabase (`_harness_supabase.js`, bloc « Cloisonnement par organisme ») joue trois organismes : ECF BOUSCAREN (n° 1,
rédacteur des contenus communs), « Organisme B » (n° 2, non rédacteur, une promo) et « Organisme C » (n° 3, aucune promo). L'accès
support du fondateur y est gardé le temps de l'onglet (sessionStorage), ce qui lui fait passer les rechargements de l'app.
Leviers : `?organisme=b` (le compte joué appartient à B), `panne`, `absent` (base d'avant le cloisonnement).

Ce que ces parcours ne prouvent pas : que la base cloisonne. Les droits se prouvent par les preuves SQL du chantier
(tests/sql/cloisonnement-*-preuve.sql) ; ici, l'écran seulement.
"""
import re

from . import parcours
from .navigation import SOUS_ONGLET, texte
from .visite import BLOQUE

SECTION = "#param-acces-support"
TITRE_SECTION = SECTION + ' h3:text-is("Accès support")'
ETAT = "#acces-support-etat"
CHOIX = "#acces-support-organisme"
MOTIF = "#acces-support-motif"
OUVRIR = SECTION + ' button:text-is("Ouvrir un accès support")'
FENETRE = ".confirmer-fond"
BANDEAU = "#support-bandeau"
# Le texte du bandeau, spec § 5.4 : « Accès support : <nom>, jusqu'à HH h MM » (heure sans zéro devant, minutes sur deux chiffres).
TEXTE_BANDEAU_B = re.compile(r"^Accès support : Organisme B, jusqu'à \d{1,2} h \d{2}$")
ECF = "ECF BOUSCAREN"
# Réglages en un clic sur ordinateur, deux sur téléphone (« Plus »), puis « Ouvrir un accès support ».
BUDGET_OUVRIR = {"ordinateur": 2, "telephone": 3}


def _ouvrir_reglages(v):
    v.aller("Réglages")
    v.attendre(TITRE_SECTION, "la section « Accès support »", delai=8000)


def _choisir_et_motiver(v, organisme, motif):
    """Choisit l'organisme dans la liste (une liste déroulante : un choix, pas un clic compté) et tape le motif."""
    liste = v.attendre(CHOIX, "la liste des organismes")
    noms = [t.strip() for t in liste.locator("option").all_inner_texts()]
    if ECF in noms:
        v.constat("F", BLOQUE, "la liste propose l'organisme déjà affiché (%s)" % ECF, capture=True)
    if organisme not in noms:
        v.echec("« %s » absent de la liste des organismes (vus : %s)" % (organisme, ", ".join(noms)))
    liste.select_option(label=organisme)
    v.remplir(MOTIF, motif, "le motif")


@parcours("acces-support-ouvrir-fermer", "Ouvrir un accès support sur un autre organisme, puis le fermer (fondateur)",
          role="fondateur", budget=BUDGET_OUVRIR)
def acces_support_ouvrir_fermer(v):
    """Réglages, « Accès support » : Organisme B, un motif, confirmation dans une fenêtre de l'app ; l'app se recharge sous le
    bandeau « Accès support : Organisme B, jusqu'à HH h MM » ; « Fermer » du bandeau, confirmation : retour sur ECF, sans bandeau."""
    _ouvrir_reglages(v)
    v.attendre(ETAT + ':has-text("%s")' % ECF, "« Vous travaillez dans votre organisme, ECF BOUSCAREN. »")
    if v.voit(BANDEAU):
        v.constat("F", BLOQUE, "le bandeau de l'accès support est affiché sans accès ouvert", capture=True)
    _choisir_et_motiver(v, "Organisme B", "Aide au réglage des titres du centre B")
    v.toucher(OUVRIR, "« Ouvrir un accès support »")
    v.attendre(FENETRE + ':has-text("Ouvrir un accès support à Organisme B")', "la question, dans une fenêtre de l'app")
    v.toucher(FENETRE + ' button:text-is("Ouvrir l\'accès")', "« Ouvrir l'accès » (confirmation)", compte=False, ecriture=True)

    v.etape("l'app rechargée sur Organisme B")
    v.attendre(BANDEAU + " strong", "le bandeau de l'accès support", delai=10000)
    lu = v.texte(BANDEAU + " strong").strip()
    if not TEXTE_BANDEAU_B.match(lu):
        v.constat("F", BLOQUE, "texte du bandeau inattendu : « %s »" % lu, capture=True)
    v.but("accès support ouvert, bandeau affiché")
    # Le bandeau suit la personne : une autre page le garde.
    v.etape("le bandeau sur une autre page")
    v.page.evaluate("() => { location.hash = '#/planning'; }")
    v.attendre(BANDEAU + " strong", "le bandeau sur le Planning")

    v.etape("fermer depuis le bandeau")
    v.toucher(BANDEAU + ' button:text-is("Fermer")', "« Fermer » (bandeau)", compte=False)
    v.attendre(FENETRE + ':has-text("Fermer l\'accès support ?")', "la question, dans une fenêtre de l'app")
    v.toucher(FENETRE + ' button:text-is("Fermer l\'accès")', "« Fermer l'accès » (confirmation)", compte=False, ecriture=True)

    v.etape("retour sur ECF")
    v.page.wait_for_load_state("load")
    v.page.evaluate("() => { location.hash = '#/config'; }")
    v.attendre(ETAT + ':has-text("%s")' % ECF, "« Vous travaillez dans votre organisme, ECF BOUSCAREN. »", delai=10000)
    if v.voit(BANDEAU):
        v.constat("D", BLOQUE, "le bandeau reste affiché après la fermeture de l'accès support", capture=True)
    v.terminer()


@parcours("acces-support-motif-court", "Motif trop court : l'accès support n'est pas ouvert (fondateur)", role="fondateur",
          budget=BUDGET_OUVRIR)
def acces_support_motif_court(v):
    """Un motif de moins de 10 caractères : un message le dit, aucune fenêtre de confirmation, aucun appel à la base."""
    _ouvrir_reglages(v)
    _choisir_et_motiver(v, "Organisme B", "   court  ")
    v.ecouter_messages()
    v.toucher(OUVRIR, "« Ouvrir un accès support »")
    v.exiger_confirmation("le motif trop court", "Le motif doit compter au moins 10 caractères")
    v.but("motif refusé")
    if v.voit(FENETRE):
        v.constat("E", BLOQUE, "une fenêtre de confirmation s'ouvre malgré le motif trop court", capture=True)
    appels = [a["name"] for a in v.page.evaluate("() => window.__HARNESS_SUPPORT_APPELS || []")]
    if "ouvrir_acces_support" in appels:
        v.constat("E", BLOQUE, "ouvrir_acces_support appelée avec un motif trop court")
    if v.voit(BANDEAU):
        v.echec("le bandeau de l'accès support est affiché")
    v.terminer()


@parcours("acces-support-sans-promo", "Accès support sur un organisme sans promo : refermé aussitôt (fondateur)", role="fondateur",
          budget=BUDGET_OUVRIR)
def acces_support_sans_promo(v):
    """Organisme C n'a aucune promo : après « Ouvrir l'accès », l'app le referme aussitôt et le dit ; elle ne se recharge pas
    et reste sur ECF."""
    _ouvrir_reglages(v)
    _choisir_et_motiver(v, "Organisme C", "Préparer l'arrivée de l'organisme C")
    v.toucher(OUVRIR, "« Ouvrir un accès support »")
    v.attendre(FENETRE + ':has-text("Ouvrir un accès support à Organisme C")', "la question, dans une fenêtre de l'app")
    v.ecouter_messages()
    v.toucher(FENETRE + ' button:text-is("Ouvrir l\'accès")', "« Ouvrir l'accès » (confirmation)", compte=False, ecriture=True)
    v.exiger_confirmation("l'ouverture sur un organisme sans promo", "aucune promo", delai=6000)
    v.but("accès refermé, phrase affichée")
    appels = [a["name"] for a in v.page.evaluate("() => window.__HARNESS_SUPPORT_APPELS || []")]
    if "fermer_acces_support" not in appels:
        v.constat("E", BLOQUE, "l'accès support n'est pas refermé (fermer_acces_support jamais appelée)")
    if v.voit(BANDEAU):
        v.constat("F", BLOQUE, "le bandeau de l'accès support est affiché pour un organisme sans promo", capture=True)
    v.attendre(ETAT + ':has-text("%s")' % ECF, "toujours sur ECF")
    v.terminer()


@parcours("acces-support-absent-pour-le-formateur", "L'accès support n'existe pas pour un formateur", role="formateur",
          budget={"ordinateur": 1, "telephone": 2})
def acces_support_absent_formateur(v):
    """Réglages d'un formateur : ni la section « Accès support », ni le bandeau."""
    v.aller("Réglages")
    v.attendre("#view .param-section", "les réglages")
    v.but("réglages affichés")
    if v.voit(TITRE_SECTION):
        v.constat("F", BLOQUE, "un formateur voit la section « Accès support »", capture=True)
    if v.voit(BANDEAU):
        v.constat("F", BLOQUE, "un formateur voit le bandeau de l'accès support", capture=True)
    v.terminer()


def _questions_contestees(v):
    v.aller("Questions contestées")
    v.attendre("#view .qcm-signal-item", "la liste des questions contestées")
    v.but("questions contestées affichées")
    item = "#view .qcm-signal-item"
    if not v.voit(item + ' button:text-is("Question corrigée")') or not v.voit(item + ' button:text-is("Pas d\'erreur")'):
        v.constat("F", BLOQUE, "« Question corrigée » ou « Pas d'erreur » manque", capture=True)
    return item


@parcours("organisme-non-redacteur", "Formateur d'un organisme qui ne rédige pas : contestations sans éditeur", role="formateur",
          budget={"ordinateur": 2, "telephone": 3}, banc={"organisme": "b", "signalements": "1"})
def organisme_non_redacteur(v):
    """Organisme B (non rédacteur) : « Questions contestées » garde « Question corrigée » et « Pas d'erreur », sans « Ouvrir dans
    l'éditeur » ; ni « Propositions IA » ni « Proposer avec l'IA » (la base refuserait l'écriture des contenus communs)."""
    item = _questions_contestees(v)
    if v.voit(item + ' button:text-is("Ouvrir dans l\'éditeur")'):
        v.constat("F", BLOQUE, "« Ouvrir dans l'éditeur » offert à un organisme qui ne rédige pas", capture=True)
    if v.voit(texte("Propositions IA", SOUS_ONGLET)):
        v.constat("F", BLOQUE, "le sous-onglet « Propositions IA » est offert à un organisme qui ne rédige pas", capture=True)
    v.terminer()


@parcours("organisme-redacteur", "Formateur d'ECF (organisme rédacteur) : l'éditeur reste offert", role="formateur",
          budget={"ordinateur": 2, "telephone": 3}, banc={"signalements": "1"})
def organisme_redacteur(v):
    """Contre-épreuve du précédent : chez ECF, « Ouvrir dans l'éditeur » et « Propositions IA » sont là ; leur absence chez B
    vient donc de l'organisme, pas du banc."""
    item = _questions_contestees(v)
    if not v.voit(item + ' button:text-is("Ouvrir dans l\'éditeur")'):
        v.constat("F", BLOQUE, "« Ouvrir dans l'éditeur » manque chez ECF, organisme rédacteur", capture=True)
    if not v.voit(texte("Propositions IA", SOUS_ONGLET)):
        v.constat("F", BLOQUE, "le sous-onglet « Propositions IA » manque chez ECF, organisme rédacteur", capture=True)
    v.terminer()
