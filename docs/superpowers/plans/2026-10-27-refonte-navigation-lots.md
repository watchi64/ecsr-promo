# Refonte de la navigation : découpage en lots

Spec : `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` (validée par Timy le 27/10,
avec les 4 choix par défaut : barre du stagiaire en bas sur iPhone, indicateurs gardés par les formateurs
pour leurs promos, pas de données nominatives au siège, cours publiés par les formateurs et contenus
communs par le siège). Maquette de référence : `docs/maquettes/refonte-navigation.src.html` (artefact
« Nouvelle navigation ECSR », version 3).

La spec couvre plusieurs sous-systèmes indépendants : un plan par lot, chacun livrable, testable et
mis en ligne seul (poussée par Timy, entrée Nouveautés à chaque mise en ligne visible).

| Lot | Contenu | Dépend de | Base de données | Plan |
|---|---|---|---|---|
| 1 | Coquille de navigation : barre d'onglets du stagiaire (haut sur ordinateur, bas sur téléphone), barre latérale repliable du formateur (« Plus » sur téléphone), menu du compte, assistant nommé, redirections des anciennes adresses ; derrière un interrupteur par promo | rien | un réglage par promo (table `settings`, comme l'émargement) | `2026-10-27-refonte-navigation-lot-1-coquille.md` |
| 2 | Pages d'accueil et planning : Accueil du stagiaire (journée, « Signer pour ce matin », À faire, pastille de date, salutation), Aujourd'hui du formateur, planning en grille de semaine (bande de jours sur téléphone) | lot 1 | aucune | à écrire après le lot 1 |
| 3 | Habillage ECF : jetons sous `data-skin="ecf"`, choix en un geste dans le menu du compte, mémorisé sur l'appareil puis sur le compte ; chasse aux couleurs écrites en dur | lot 1 (menu du compte) | une colonne de préférence sur le profil | à écrire |
| 4 | Rôles et portées en base : affectations (stagiaire, formateur, direction, siège) sur une promo, un centre ou le réseau, règles RLS, migration des rôles actuels, « Voir en tant que » étendu aux 4 rôles | rien (peut avancer en parallèle du lot 2) | oui : table d'affectations, fonctions RLS, migration gardée et prouvée | à écrire |
| 5 | Espaces direction et siège : Accueil (vue d'ensemble du centre, du réseau), Promos, Équipe, Émargement (export), Notes et examens, Directions de centre, réglages du centre et du réseau (dont l'habillage par défaut) | lots 1, 3 et 4 | lectures agrégées | à écrire |
| 6 et suivants | Chantiers suivants, chacun avec sa propre spec : signaler un problème, dossier Qualiopi, veille réglementaire | lot 5 pour Qualiopi | selon le chantier | spec à écrire |

Règles communes à tous les lots (spec, § 3) : garder la DA de Timy (vert mint, Canela, Outfit, Geist Mono,
barre espresso, pastille de date, nom en vert, échelle douce des notes, dés, comptes à rebours) ; aucun
défilement de côté, sauf la matrice des notes ; zones à toucher de 44 px sur téléphone ; contraste AA ;
jamais de tiret cadratin ; worktree de l'app hors de `C:/Users/watch/Dev/ECSR` ; commit local, Timy pousse.
