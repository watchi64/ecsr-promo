# Promo ECSR — Suivi des passages

Application web propriétaire dédiée à la gestion pédagogique d'une promotion en formation TP ECSR (Enseignant de la Conduite et de la Sécurité Routière).

**© 2026 watchi64 — Tous droits réservés.** Voir [LICENSE](./LICENSE) pour les conditions d'utilisation.

---

## Vue d'ensemble

L'app couvre :

| Module | Rôle |
|---|---|
| **Accueil** | Salutation personnalisée, compte à rebours du prochain événement majeur, raccourcis |
| **Tableau de bord** | Synthèse temps réel des passages, priorités calculées automatiquement |
| **Planning** | Planning hebdomadaire avec activités, formateurs, pédagogue & élèves, export PDF A4 |
| **Calendrier** | Dates clés de la formation (stages, examens) |
| **Thèmes** | Suivi des 57 thèmes officiels + compétences TP ECSR / REMC, QCM par thème |
| **Passages** | Historique complet des passages (salle, voiture, bonus, absences) |
| **Notes** | Évaluations par thème (1-57), compétence ou contrôle, avec historique des modifications |
| **Ressources & contacts** | Bibliothèque curée de liens utiles (Légifrance, REMC, etc.) + contacts du centre |
| **Paramètres** | Invitations & accès, préférences personnelles, gestion de la promo (admin) |

## Stack

- **Front** : HTML / CSS / JS vanilla (modules ES), design system custom, polices auto-hébergées (Canela, Outfit, Geist Mono)
- **Backend** : Supabase (PostgreSQL 17 + REST + Auth email/mot de passe)
- **Hébergement** : GitHub Pages (statique)

## Accès

- **Connexion individuelle** : email + mot de passe (Supabase Auth). Pas de mot de passe partagé, pas de magic link.
- **Whitelist côté serveur** : la création de compte n'est possible que si l'email a été invité par un admin (table `user_profiles`, trigger SQL bloquant à l'inscription). Aucun email n'est envoyé par l'app.
- **Rôles** : `stagiaire` ou `prof`, avec un flag `is_admin` orthogonal (un stagiaire peut être admin). Les écritures sensibles sont réservées aux admins.

## Sécurité

- Row Level Security activée sur toutes les tables ; écritures verrouillées côté base (`is_admin()`), pas seulement côté interface.
- Whitelist d'inscription appliquée en SQL (`enforce_whitelist_signup`), impossible à contourner côté client.
- Audit trail automatique sur les évaluations et les passages (`*_audit`, triggers Postgres : qui, quand, quoi).
- Content Security Policy stricte (pas de scripts inline, `frame-ancestors 'none'`).
- Polices auto-hébergées : aucune requête vers des services tiers de fonts.

## Schéma BDD (principales tables)

```
stagiaires              (id, prenom, nom, ordre, actif)
profs                   (id, nom, ordre)
user_profiles           (email PK, role, stagiaire_id?, prof_id?, is_admin, …)   -- whitelist
themes                  (57 thèmes officiels + compétences TP ECSR / REMC)
competences             (code, libelle, ordre)
passages                (date, stagiaire_id, type, resultat, origine, …)
planning_entries        (semaine_lundi, day_index, half_day, slot, …)
evaluations             (stagiaire_id, type, theme_numero, competence_code, note, …)
passages_audit / evaluations_audit   (audit trail, écriture par triggers uniquement)
qcm / qcm_questions / qcm_options / qcm_attempts   (QCM par thème)
agenda_events, contacts, ressources, settings
```

---

## Propriété intellectuelle

Ce projet — design, code, architecture, schéma de données, contenu pédagogique — constitue une œuvre originale protégée par le droit d'auteur.

**Pour toute demande de licence commerciale** (intégration en école de conduite, déploiement pour un réseau, monétisation, etc.) : misterwatchi@gmail.com

Voir [LICENSE](./LICENSE).
