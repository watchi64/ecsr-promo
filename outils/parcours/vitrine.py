# -*- coding: utf-8 -*-
"""Vitrine de la promo de démonstration (js/vitrine-rules.js) : le fondateur, en aperçu « Stagiaire » dans la promo 7, voit
l'app comme Camille, stagiaire fictive, EN LECTURE SEULE. Il peut dérouler un examen et un entraînement pour les montrer :
rien n'est enregistré, et l'écran le dit.

Ce que ces parcours prouvent : l'écran (qui est montré, ce qui est dit, aucune écriture demandée au faux Supabase). Ce
qu'ils ne prouvent pas : le sort de l'en-tête x-apercu-role, que le faux Supabase ne voit pas ; il est décidé par
requeteDeDonnees (tests/vitrine-rules.test.mjs).
"""
from . import parcours
from .direction import choisir_un_apercu, revenir_fondateur
from .navigation import texte
from .stagiaire import QCM_DU_THEME, PASSER, fermer_la_fiche_du_qcm
from .visite import BLOQUE

BANC = {"centre": "1", "demo": "1"}
# Avec le planning, les dates clés et les dossiers de la promo de démonstration (carte « Aujourd'hui » de l'Accueil).
BANC_PLANNING = {"centre": "1", "demo": "1", "qualiopi": "1"}
CAMILLE = "Camille M."
AUTRE = 1635  # une autre fiche de la promo de démonstration
EXAMEN_OUVERT = ("{ promo_id: 7, published: true, published_by_email: null, published_at: null, exam_nb_questions: null, "
                 "exam_question_ids: null, exam_draw_mode: null, exam_seconds_per_question: 30, exam_ferme_a: null }")
# Le QCM du banc (id 50, le seul qui ait des questions) est celui du thème 1 quand la promo de démonstration est chargée.
THEME = "Signalisation verticale"
# Son examen ouvert dans la promo 7, et la copie d'une AUTRE fiche de la promo : le fondateur lit toute la
# promo, la vitrine ne doit montrer que les lignes de Camille (sinon « Tu as déjà passé cet examen », avec la note d'un autre).
SEMIS = ("FIXTURES.qcm.find((q) => q.id === 50).examen.push(%s);" % EXAMEN_OUVERT,
         "FIXTURES.qcm_attempts.push({ id: 9901, qcm_id: 50, stagiaire_id: %d, promo_id: 7, mode: 'examen', score: 3, total: 3, "
         "note_20: 20, answers: {}, finished_at: '2026-10-27T09:00:00Z' });" % AUTRE)
QUESTION = ".modal-backdrop.confirmer-fond"
ECRITURE = ("[banc] écriture ignorée", "[banc] ecriture gardee")


def suivre_les_ecritures(v):
    """Toute écriture demandée au faux Supabase laisse une ligne dans la console : on les garde pour les compter."""
    vues = []
    v.page.on("console", lambda m: vues.append(m.text) if any(e in m.text for e in ECRITURE) else None)
    return vues


def entrer_dans_la_vitrine(v, compter=True):
    """Menu du compte, « Voir en tant que », Stagiaire : le bandeau nomme la fiche fictive et dit que rien n'est enregistré."""
    choisir_un_apercu(v, "Stagiaire", "stagiaire", "Stagiaire", compter=compter)
    v.espace = "stagiaire"
    bandeau = v.texte("#impersonation-banner")
    if CAMILLE not in bandeau or "Rien n'est enregistré à son nom" not in bandeau:
        v.constat("D", BLOQUE, "le bandeau d'aperçu ne dit pas la vitrine (« %s »)" % bandeau.strip()[:120], capture=True)


def aucune_ecriture(v, vues, quand):
    if vues:
        v.constat("E", BLOQUE, "%s : une écriture est partie dans la vitrine (%s)" % (quand, vues[0][:120]), capture=True)


@parcours("vitrine-apercu-stagiaire", "Le fondateur voit la promo de démonstration comme Camille (aperçu Stagiaire)",
          role="fondateur", budget=4, banc=BANC_PLANNING, depart="#/home")
def vitrine_apercu(v):
    """Promo 7, aperçu Stagiaire : le bandeau dit la vitrine, l'Accueil (salut, carte « Aujourd'hui ») et Mon suivi sont ceux
    de Camille ; « Revenir fondateur » rend l'espace de l'équipe et retire le bandeau."""
    vues = suivre_les_ecritures(v)
    entrer_dans_la_vitrine(v)
    accueil = v.attendre("#view", "l'Accueil du stagiaire").inner_text()
    accueil = " ".join(accueil.split())
    if "Bonjour, Camille" not in accueil:
        v.constat("D", BLOQUE, "l'Accueil de la vitrine ne salue pas Camille", capture=True)
    # Carte « Aujourd'hui » (12/11) : la journée de Camille au planning de la démonstration, le mercredi 28/10 du banc.
    if "Tu suis le cours" not in accueil:
        v.constat("D", BLOQUE, "la carte « Aujourd'hui » de la vitrine ne dit pas la journée de Camille", capture=True)
    v.but("Accueil de Camille")
    v.controler_ecran("Accueil en vitrine")
    v.aller("Mon suivi")
    v.attendre("#view :is(h1, h2):visible", "Mon suivi")
    v.controler_ecran("Mon suivi en vitrine")
    aucune_ecriture(v, vues, "Accueil et Mon suivi")
    revenir_fondateur(v)
    v.terminer()


@parcours("vitrine-examen-sans-enregistrement", "Le fondateur déroule l'examen de Camille sans rien enregistrer",
          role="fondateur", budget=8, banc=BANC, semis=SEMIS, depart="#/home")
def vitrine_examen(v):
    """Promo 7, aperçu Stagiaire, QCM du thème 1 dont l'examen est ouvert : la fiche propose « Passer l'examen » (la copie
    d'une autre fiche ne compte pas pour Camille), l'écran d'avant dit que la note ne sera pas enregistrée, l'examen se
    déroule, le résultat le redit, et aucune écriture n'est demandée."""
    vues = suivre_les_ecritures(v)
    entrer_dans_la_vitrine(v)
    v.aller("Cours et QCM")
    v.etape("ouvrir le QCM du thème 1")
    v.toucher(QCM_DU_THEME % THEME, "le bouton « QCM » du thème 1")
    v.attendre(PASSER, "« Passer l'examen » sur la fiche du QCM")
    cartes = v.texte(".theme-modal .qcm-note-cards")
    if "20/20" in "".join(cartes.split()):
        v.constat("E", BLOQUE, "la fiche montre à Camille la note d'examen d'une autre fiche (« %s »)" % " ".join(cartes.split())[:80],
                  capture=True)
    v.toucher(PASSER, "« Passer l'examen »")
    v.attendre(texte("Commencer l'examen", "button"), "l'écran « Prêt pour l'examen ? »")
    avant = v.texte(".qcm-prescreen")
    if "Démonstration : la note ne sera pas enregistrée." not in avant:
        v.constat("D", BLOQUE, "l'écran d'avant l'examen ne dit pas que rien ne sera enregistré", capture=True)
    v.toucher(texte("Commencer l'examen", "button"), "« Commencer l'examen »")
    v.attendre("button.qcm-choice", "la première question de l'examen")
    v.but("examen de démonstration commencé")
    v.toucher("button.qcm-choice", "une réponse", compte=False)
    v.toucher('button:text-is("Terminer l\'examen")', "« Terminer l'examen »", compte=False)
    v.attendre(QUESTION, "la question « Terminer l'examen ? », dans une fenêtre de l'app")
    v.toucher(QUESTION + ' button:text-is("Terminer")', "« Terminer »", compte=False)
    v.attendre(".qcm-score-big", "le résultat de l'examen")
    fin = v.texte(".qcm-results")
    if "Démonstration : cette note n'est pas enregistrée." not in fin:
        v.constat("D", BLOQUE, "le résultat ne dit pas que la note n'est pas enregistrée", capture=True)
    if "Note non enregistrée" in fin:
        v.constat("D", BLOQUE, "le résultat annonce un échec d'enregistrement au lieu de la démonstration", capture=True)
    v.controler_ecran("résultat de l'examen en vitrine")
    aucune_ecriture(v, vues, "examen déroulé")
    fermer_la_fiche_du_qcm(v)
    v.terminer()


@parcours("vitrine-entrainement-sans-enregistrement", "Le fondateur déroule un entraînement de Camille sans rien enregistrer",
          role="fondateur", budget=6, banc=BANC, depart="#/home")
def vitrine_entrainement(v):
    """Promo 7, aperçu Stagiaire : « S'entraîner » sur le QCM du thème 1 jusqu'à la note ; le résultat dit que l'entraînement
    n'est pas enregistré, et aucune écriture n'est demandée."""
    vues = suivre_les_ecritures(v)
    entrer_dans_la_vitrine(v)
    v.aller("Cours et QCM")
    v.etape("ouvrir le QCM du thème 1")
    v.toucher(QCM_DU_THEME % THEME, "le bouton « QCM » du thème 1")
    v.toucher(".theme-modal " + 'button:text-is("S\'entraîner")', "« S'entraîner »")
    v.attendre("button.qcm-choice", "la première question")
    v.but("entraînement de démonstration commencé")
    for n in range(1, 41):
        if v.voit(".qcm-score-big"):
            break
        v.etape("question %d" % n)
        v.toucher("button.qcm-choice:not(.disabled)", "une réponse", compte=False)
        v.toucher("button.qcm-next:visible", "« Valider »", compte=False)
        v.toucher("button.qcm-next:visible", "« Question suivante » ou « Voir le résultat »", compte=False)
    v.attendre(".qcm-score-big", "la note de l'entraînement")
    fin = v.texte(".qcm-results")
    if "Démonstration : cet entraînement n'est pas enregistré." not in fin:
        v.constat("D", BLOQUE, "le résultat ne dit pas que l'entraînement n'est pas enregistré", capture=True)
    v.controler_ecran("résultat de l'entraînement en vitrine")
    aucune_ecriture(v, vues, "entraînement déroulé")
    fermer_la_fiche_du_qcm(v)
    v.terminer()


COMPTE = 'button[data-nav-action="compte"]'


@parcours("vitrine-quitter-pendant-l-examen", "Le fondateur quitte la vitrine en plein examen : rien ne part, rien ne reste",
          role="fondateur", budget=8, banc=BANC, semis=SEMIS, depart="#/home")
def vitrine_quitter(v):
    """Promo 7, aperçu Stagiaire, examen commencé puis « Revenir fondateur » (le bandeau reste au-dessus de l'examen) : l'app se
    recharge dans l'espace de l'équipe, l'examen et son minuteur ont disparu, aucune écriture n'est demandée, et le compte
    affiché n'est plus Camille (la fiche empruntée ne reste pas dans le profil du fondateur)."""
    vues = suivre_les_ecritures(v)
    entrer_dans_la_vitrine(v)
    v.aller("Cours et QCM")
    v.etape("commencer l'examen du thème 1")
    v.toucher(QCM_DU_THEME % THEME, "le bouton « QCM » du thème 1")
    v.toucher(PASSER, "« Passer l'examen »")
    v.toucher(texte("Commencer l'examen", "button"), "« Commencer l'examen »")
    v.attendre("button.qcm-choice", "la première question de l'examen")
    v.toucher("button.qcm-choice", "une réponse", compte=False)
    v.but("examen de démonstration commencé")
    revenir_fondateur(v)
    v.espace = "equipe"
    v.attendre(COMPTE, "le bouton du compte, après le rechargement")
    if v.voit(".qcm-overlay"):
        v.constat("E", BLOQUE, "l'examen commencé en vitrine est encore ouvert dans l'espace du fondateur", capture=True)
    compte = v.page.locator(COMPTE).first.get_attribute("aria-label") or v.texte(COMPTE)
    if "Camille" in compte:
        v.constat("E", BLOQUE, "hors vitrine, le compte affiché est encore Camille (« %s »)" % compte.strip()[:80], capture=True)
    aucune_ecriture(v, vues, "sortie de la vitrine en plein examen")
    v.terminer()
