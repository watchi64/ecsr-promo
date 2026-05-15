# Promo ECSR — Suivi des passages

Application web propriétaire dédiée à la gestion pédagogique d'une promotion en formation TP ECSR (Enseignant de la Conduite et de la Sécurité Routière).

**© 2026 watchi64 — Tous droits réservés.** Voir [LICENSE](./LICENSE) pour les conditions d'utilisation.

---

## Vue d'ensemble

L'app couvre :

| Module | Rôle |
|---|---|
| **Tableau de bord** | Synthèse temps réel des passages, priorités calculées automatiquement |
| **Planning** | Planning hebdomadaire avec activités, profs, pédagogue & élèves |
| **Passages** | Historique complet des passages (salle, voiture, bonus, absences) |
| **Notes** | Évaluations par thème (1-57), compétence (C1-C4) ou contrôle, avec historique des modifications |
| **Ressources** | Bibliothèque curée de liens utiles (Légifrance, REMC, etc.) |
| **Config** | Gestion des stagiaires, formateurs et mot de passe partagé |

## Stack

- **Front** : HTML / CSS / JS vanilla (modules ES), typo Geist, design system custom
- **Backend** : Supabase (PostgreSQL 17 + REST + Realtime + Auth magic link)
- **Hébergement** : GitHub Pages (statique)

## Niveaux d'accès

1. **Mot de passe partagé** (tier 1) — accès en lecture/écriture pour la promo : tableau de bord, planning, passages, notes (lecture), ressources (lecture).
2. **Connexion admin** (tier 2, Supabase magic link) — débloque l'édition des notes et des ressources. Toutes les modifications de notes sont auditées (qui, quand, quoi).

## Sécurité

- Mot de passe partagé hashé en SHA-256 côté serveur (table `settings`).
- Row Level Security activé sur toutes les tables.
- Audit trail automatique sur les évaluations (`evaluations_audit`, triggers Postgres).
- Auth admin via OTP email (Supabase Auth) — pas de mot de passe à stocker.

## Schéma BDD

```
stagiaires              (id, prenom, ordre)
profs                   (id, nom, ordre)
competences             (code, libelle, ordre)            -- C1, C2, C3, C4
passages                (date, stagiaire_id, type, resultat, origine, …)
planning_entries        (semaine_lundi, day_index, half_day, slot, …)
evaluations             (stagiaire_id, type, theme_numero, competence_code, controle_libelle, note, …)
evaluations_audit       (evaluation_id, action, before_data, after_data, changed_by_email, …)
ressources              (titre, url, description, categorie, …)
settings                (key/value)
```

---

## Propriété intellectuelle

Ce projet — design, code, architecture, schéma de données, contenu pédagogique — constitue une œuvre originale protégée par le droit d'auteur.

**Pour toute demande de licence commerciale** (intégration en école de conduite, déploiement pour un réseau, monétisation, etc.) : misterwatchi@gmail.com

Voir [LICENSE](./LICENSE).
