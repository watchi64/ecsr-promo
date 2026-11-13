# -*- coding: utf-8 -*-
"""Parcours du travail en autonomie (lot 1 e-learning, 13/11/2026).

Quatre parcours : le stagiaire lit un cours et retrouve sa trace (interrupteur allumé), la fiche vue par l'équipe, le fondateur qui
allume l'interrupteur, et la preuve à l'écran que « éteint = rien de nouveau » (interrupteur éteint, par défaut).

Le faux Supabase joue les trois fonctions autonomie_* en mémoire (blocs « autonomie (lot 1 e-learning) » de _harness_supabase.js) ;
les traces vivent dans `window.__HARNESS_AUTONOMIE` ({ lectures, temps }), que les semis remplissent. Le levier d'adresse
`autonomie=1` allume l'interrupteur de la promo 1. Le plancher de temps actif d'un cours (30 % du temps de lecture estimé) ne
s'attend pas : un semis pose déjà des secondes sur le cours, pour que « atteindre la fin » soit le geste qui rend le cours lu.
"""
import re

from . import parcours
from .navigation import texte, SOUS_ONGLET
from .visite import BLOQUE

NOUVELLE = ("nouvelle",)
PARTIE = "Travail en autonomie"
LIGNE_FEUX = '#view .theme-row:has-text("Feux du véhicule")'
BOUTON_COURS = LIGNE_FEUX + " button.theme-cours-btn"
LECTEUR = ".cours-overlay"
LECTEUR_CHARGE = LECTEUR + ' .cours-head-meta:has-text("min de lecture")'
REPERES = "#view .ms-autonomie li.res-sujet"
NOTE_STAGIAIRE = "Ton formateur voit exactement cette page."

# Une lecture déjà faite (cours 1, « Feux du véhicule ») : ouverte, vue et lue le mardi 27/10 ; le banc est gelé au 28/10.
def _lecture(stagiaire, lu=True, section=None):
    return ("window.__HARNESS_AUTONOMIE.lectures.push({ stagiaire_id: %d, promo_id: 1, cours_id: 1, "
            "ouvert_le: '2026-10-27T08:00:00.000Z', vu_le: '2026-10-27T08:20:00.000Z', lu_le: %s, "
            "fin_atteinte: %s, section: %s });" % (stagiaire, "'2026-10-27T08:20:00.000Z'" if lu else "null",
                                                  "true" if lu else "false", "'%s'" % section if section else "null"))


def _temps(stagiaire, secondes):
    return ("window.__HARNESS_AUTONOMIE.temps.push({ stagiaire_id: %d, promo_id: 1, jour: '2026-10-27', genre: 'cours', "
            "ressource: '1', secondes: %d });" % (stagiaire, secondes))


# Stagiaire 1 (le compte du banc) a déjà passé 5 minutes sur le cours 1 : le plancher (18 s pour ce cours court) est franchi, il ne
# manque que la fin du cours.
SEMIS_LIRE = (_temps(1, 300),)
# Céline A. (id 6, la première de la liste par nom, donc la fiche ouverte d'emblée sur ordinateur), Anissa O. (2) et Lorie K. (3)
# ont lu le cours 1 ; Céline y a passé 25 minutes. La promo compte 6 stagiaires actifs : « 3 sur 6 l'ont lu ».
SEMIS_EQUIPE = (_lecture(6), _lecture(2), _lecture(3), _temps(6, 1500))
# Interrupteur ÉTEINT, mais des traces d'un temps où il était allumé : une lecture finie avec une section retenue (de quoi montrer
# le bandeau de reprise) et 5 minutes. Éteint, rien ne doit s'afficher ni se modifier.
SEMIS_ETEINTE = (_lecture(1, lu=True, section="2-contenu-du-cours"), _temps(1, 300))


def ouvrir_le_cours(v):
    """Ouvre le cours « Feux du véhicule » depuis la liste des thèmes et attend qu'il soit affiché."""
    v.etape("ouvrir le cours du thème « Feux du véhicule »")
    v.toucher(BOUTON_COURS, "le bouton « Cours » du thème")
    v.attendre(LECTEUR, "le lecteur de cours")
    v.attendre(LECTEUR_CHARGE, "le cours chargé (titre, sections et temps de lecture)")


def aller_a_la_fin(v):
    """Fait défiler le lecteur jusqu'en bas, puis attend deux images : l'observateur de visibilité du repère de fin répond à
    l'image suivant le défilement, et fermer avant lui perdrait la fin."""
    v.etape("lire jusqu'à la fin du cours")
    v.page.locator(LECTEUR + " .cours-scroll").first.evaluate(
        "(e) => { e.scrollTop = e.scrollHeight; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }")


def fermer_le_cours(v):
    v.etape("refermer le cours")
    if v.telephone:
        v.toucher("button.cours-close", "« Fermer le cours »", compte=False)
    else:
        v.fermer_par_echap(LECTEUR, "le lecteur de cours")
        if v.voit(LECTEUR):
            v.toucher("button.cours-close", "« Fermer le cours »", compte=False)
    if v.voit(LECTEUR):
        v.constat("D", BLOQUE, "le lecteur de cours ne se referme pas", capture=True)


def ouvrir_la_partie(v):
    """Ouvre la partie « Travail en autonomie » (sous-onglet sur ordinateur, ligne du sommaire sur téléphone)."""
    v.etape("ouvrir la partie « %s »" % PARTIE)
    v.toucher(texte(PARTIE, SOUS_ONGLET), "la partie « %s »" % PARTIE)
    v.attendre("#view .ms-autonomie li.res-sujet", "les repères de la partie")


def reperes(v):
    return [t.strip() for t in v.page.locator(REPERES).all_inner_texts()]


def exiger_repere(v, lus, motif, quoi):
    if not any(re.fullmatch(motif, t) for t in lus):
        v.echec("repère « %s » introuvable (repères lus : %s)" % (quoi, " / ".join(lus) or "aucun"))


@parcours("autonomie-lire-un-cours", "Lire un cours jusqu'au bout et le retrouver « Lu » dans Mon suivi", role="stagiaire",
          budget=4, navigations=NOUVELLE, banc={"autonomie": "1"}, semis=SEMIS_LIRE)
def lire_un_cours_suivi(v):
    """Interrupteur allumé : le stagiaire lit un cours jusqu'à la fin, le referme, trouve « Lu » sur le bouton du cours et, dans
    Mon suivi, la partie « Travail en autonomie » avec « Cours lus : 1 sur … » et la phrase « Ton formateur voit exactement cette page. »."""
    v.aller("Cours et QCM")
    v.attendre(BOUTON_COURS, "le bouton « Cours » du thème 22")
    if v.voit(LIGNE_FEUX + " .theme-cours-lu"):
        v.echec("le cours est déjà marqué « Lu » avant d'être lu")
    ouvrir_le_cours(v)
    if v.voit(".cours-reprise"):
        v.constat("D", BLOQUE, "un bandeau de reprise s'affiche à la première lecture d'un cours", capture=True)
    aller_a_la_fin(v)
    fermer_le_cours(v)
    v.etape("la marque « Lu » sur le bouton du cours")
    v.attendre(LIGNE_FEUX + " button.theme-cours-btn.lu .theme-cours-lu:text-is(\"Lu\")", "la marque « Lu » sur le bouton « Cours » du thème")
    v.aller("Mon suivi")
    ouvrir_la_partie(v)
    lus = reperes(v)
    exiger_repere(v, lus, r"Cours lus : 1 sur \d+", "Cours lus : 1 sur …")
    v.attendre("#view p.ms-autonomie-note:text-is(\"%s\")" % NOTE_STAGIAIRE, "la phrase « %s »" % NOTE_STAGIAIRE)
    if not any("Feux du véhicule" in t and "Lu le " in t for t in v.page.locator("#view .ms-autonomie li.res-sujet").all_inner_texts()):
        v.echec("la liste « Cours lus et commencés » ne montre pas « Feux du véhicule » avec « Lu le … »")
    v.but("cours lu, marque « Lu » et partie « %s » trouvées" % PARTIE)
    v.terminer()


@parcours("autonomie-fiche-equipe", "Voir combien ont lu un cours et ouvrir la fiche « Travail en autonomie » d'un stagiaire",
          role="formateur", budget={"ordinateur": 3, "telephone": 5}, navigations=NOUVELLE, banc={"autonomie": "1"},
          semis=SEMIS_EQUIPE)
def fiche_equipe(v):
    """Interrupteur allumé : le formateur lit « 3 sur 6 l'ont lu » sur la ligne du thème, ouvre la fiche d'une stagiaire et y trouve
    la partie « Travail en autonomie » (cinq repères, cours lus), sans la phrase réservée au stagiaire ; un cours ouvert par lui n'a pas de bandeau de reprise."""
    v.aller("Cours et QCM")
    v.attendre(LIGNE_FEUX + ' .theme-lecteurs:text-is("3 sur 6 l\'ont lu")', "« 3 sur 6 l'ont lu » sur la ligne du thème 22")
    v.aller("Stagiaires")
    ligne = '#view a.stg-ligne:has-text("Céline")'
    v.attendre(ligne, "la ligne de Céline A. dans la liste")
    if not v.voit(ligne + ".active"):
        v.toucher(ligne, "la ligne de Céline A.")
    v.attendre("#view .stg-fiche", "la fiche de Céline A.")
    ouvrir_la_partie(v)
    lus = reperes(v)
    for motif, quoi in ((r"Cours lus : 1 sur \d+", "Cours lus"), (r"Temps cette semaine : 25 min", "Temps cette semaine : 25 min"),
                        (r"Temps depuis le début : 25 min", "Temps depuis le début : 25 min"), (r"Entraînements QCM : \d+", "Entraînements QCM"),
                        (r"Dernière activité : .+", "Dernière activité")):
        exiger_repere(v, lus, motif, quoi)
    if not any("Feux du véhicule" in t and "Lu le " in t for t in lus):
        v.echec("la liste « Cours lus et commencés » ne montre pas « Feux du véhicule » avec « Lu le … »")
    if v.voit("#view .ms-autonomie-note") or "Ton formateur voit" in v.texte("#view"):
        v.constat("D", BLOQUE, "la phrase réservée au stagiaire (« %s ») s'affiche sur la fiche vue par l'équipe" % NOTE_STAGIAIRE, capture=True)
    v.but("fiche de Céline A. : partie « %s » et ses cinq repères" % PARTIE)
    v.etape("un cours ouvert par le formateur n'a pas de bandeau de reprise")
    v.aller("Cours et QCM")
    ouvrir_le_cours(v)
    if v.voit(".cours-reprise") or v.voit(".cours-fin-repere"):
        v.constat("D", BLOQUE, "le formateur voit un bandeau de reprise ou le suivi d'un cours dans le lecteur", capture=True)
    v.terminer()


@parcours("autonomie-interrupteur", "Allumer le travail en autonomie pour la promo (fondateur)", role="fondateur",
          budget={"ordinateur": 2, "telephone": 3}, navigations=NOUVELLE, banc={"ecritures": "1"})
def interrupteur(v):
    """Dans Réglages, le fondateur trouve la section « Travail en autonomie » éteinte, coche la case : le message du bas confirme
    « Travail en autonomie activé pour <promo>. » et la case reste cochée."""
    v.aller("Réglages")
    v.attendre('#view h3:text-is("%s")' % PARTIE, "la section « %s »" % PARTIE)
    case = "#autonomie-actif"
    v.attendre(case, "la case de l'interrupteur")
    if v.page.locator(case).first.is_checked():
        v.echec("l'interrupteur est déjà allumé au départ (le banc l'allume-t-il ?)")
    etiquette = v.texte('label[for="autonomie-actif"]')
    m = re.search(r"pour « (.+) »", etiquette)
    if not m:
        v.echec("l'étiquette de la case ne nomme pas la promo (lue : %s)" % etiquette.strip())
    promo = m.group(1)
    v.ecouter_messages()
    v.toucher(case, "la case « %s »" % PARTIE, ecriture=True)
    v.exiger_confirmation("l'allumage", "Travail en autonomie activé pour %s." % promo)
    v.attendre(case + ":checked:enabled", "la case cochée et de nouveau active")
    v.but("interrupteur allumé pour « %s »" % promo)
    v.terminer()


@parcours("autonomie-eteinte", "Interrupteur éteint : lire un cours ne change rien à l'écran", role="stagiaire", budget=3,
          navigations=NOUVELLE, semis=SEMIS_ETEINTE)
def eteinte(v):
    """Interrupteur éteint (le défaut), avec une lecture ancienne en base : le stagiaire lit un cours jusqu'à la fin, le referme :
    ni bandeau de reprise, ni marque « Lu », aucune trace écrite, et Mon suivi n'a pas de partie « Travail en autonomie »."""
    v.aller("Cours et QCM")
    v.attendre(BOUTON_COURS, "le bouton « Cours » du thème 22")
    if v.voit(LIGNE_FEUX + " .theme-cours-lu") or v.voit(LIGNE_FEUX + " button.theme-cours-btn.lu"):
        v.echec("une marque « Lu » s'affiche interrupteur éteint")
    ouvrir_le_cours(v)
    if v.voit(".cours-reprise"):
        v.echec("un bandeau de reprise s'affiche interrupteur éteint")
    if v.voit(".cours-fin-repere"):
        v.echec("le suivi de lecture est branché interrupteur éteint (repère de fin présent)")
    aller_a_la_fin(v)
    fermer_le_cours(v)
    if v.voit(LIGNE_FEUX + " .theme-cours-lu") or v.voit(LIGNE_FEUX + " button.theme-cours-btn.lu"):
        v.echec("la marque « Lu » apparaît après la lecture, interrupteur éteint")
    v.aller("Mon suivi")
    v.attendre(texte("Résultats", SOUS_ONGLET), "les parties de Mon suivi")
    if v.voit(texte(PARTIE, SOUS_ONGLET)) or PARTIE in v.texte("#view") or "Cours lus :" in v.texte("#view"):
        v.echec("Mon suivi montre la partie « %s » interrupteur éteint" % PARTIE)
    traces = v.page.evaluate(
        "() => { const a = window.__HARNESS_AUTONOMIE; return { l: a.lectures.length, t: a.temps.length, "
        "vu: a.lectures[0] && a.lectures[0].vu_le, s: a.temps[0] && a.temps[0].secondes }; }")
    if traces != {"l": 1, "t": 1, "vu": "2026-10-27T08:20:00.000Z", "s": 300}:   # tel que le semis l'a posé : la moindre trace changerait vu_le ou les secondes
        v.echec("des traces ont changé interrupteur éteint (état en mémoire : %s)" % traces)
    v.but("rien de nouveau à l'écran ni en mémoire, interrupteur éteint")
    v.terminer()
