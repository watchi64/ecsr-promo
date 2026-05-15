# 🚗 Promo ECSR — Suivi des passages

App web pour gérer le planning et le suivi des passages de la formation TP ECSR (Enseignant de la Conduite et de la Sécurité Routière).

## 🎯 Pages

- **📊 Tableau de bord** — qui doit passer cette semaine, priorités auto-calculées
- **📅 Planning de la semaine** — saisie facile avec dropdowns multi-select, navigation entre semaines
- **📝 Passages** — historique complet, filtres, ajout/suppression
- **⚙️ Config** — gestion des stagiaires, profs, mot de passe

## 🔒 Accès

L'app est protégée par un **mot de passe partagé** (à définir au premier accès).
Mot de passe stocké côté serveur (hash SHA-256), session locale dans le navigateur.

## 🛠 Stack

- HTML / CSS / vanilla JS (modules ES)
- Backend : Supabase (Postgres + REST + Realtime)
- Hébergé sur GitHub Pages

## 📦 Déploiement

L'app est statique : pousser sur GitHub, activer GitHub Pages, c'est tout.

Les credentials Supabase publics (URL + clé anon) sont dans `js/config.js`.
La sécurité repose sur :
- Le mot de passe partagé (gate côté client)
- Les Row Level Security policies Supabase (toutes les opérations passent par l'anon role)

## 🏗 Schéma BDD

5 tables :
- `stagiaires` (id, prenom, ordre)
- `profs` (id, nom, ordre)
- `passages` (date, stagiaire, type, résultat, remplaçant, origine)
- `planning_entries` (semaine_lundi, day_index, half_day, slot, activité, prof, sujet, pédagogue, élèves[], notes)
- `settings` (key/value pour password_hash, cohort_name, etc.)

## 🔄 Auto-sync Planning → Tableau de bord

Quand quelqu'un est assigné comme **"Passe au tableau"** dans une activité Pédagogie salle, il est **automatiquement compté** comme passage Salle effectué dans le Tableau de bord — pas de bouton, pas d'action manuelle, c'est en temps réel.

L'historique permanent est stocké dans `passages`. Pour archiver les pédagogues de la semaine au moment de passer à la semaine suivante : feature à venir (bouton "Archiver la semaine").

## 🧑‍💻 Dev local

L'app étant statique avec des modules ES, il faut un serveur HTTP local :

```bash
cd ecsr-promo
python -m http.server 5500
# Ouvrir http://localhost:5500
```
