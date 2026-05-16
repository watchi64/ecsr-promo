# PROJECT_NOTES.md — ecsr-promo

> **Fichier de reprise pour future session Claude.** Maintenu manuellement, à mettre à jour quand une décision structurante change. Daté : 2026-05-17.

## TL;DR

Web app de suivi de promotion **TP ECSR** (15 stagiaires + 3 profs Hocine/Raphaël/Romain). Stack : HTML/CSS/JS vanilla + Supabase. Déployée sur GitHub Pages : **https://watchi64.github.io/ecsr-promo/**.

Focus court terme : que ça marche pour la promo actuelle. Long terme possible : vendre à d'autres centres TP ECSR.

## Stack & infra

| | |
|---|---|
| Repo | `github.com/watchi64/ecsr-promo` (public) |
| Local | `C:\Users\watch\Dev\ECSR\ecsr-promo` |
| Frontend | HTML/CSS/JS vanilla, modules ES |
| Backend | Supabase Postgres, project `dacqponglpeuscbgwfqn`, région eu-west-3 |
| Typo | Canela (self-hosted) display + Outfit (Google Fonts) body + Geist Mono numbers |
| Logo | `assets/logo/tpecsr-logo.svg` (capsule TP) |
| Admin bootstrap | misterwatchi@gmail.com |

## Auth & permissions

**2 tiers** :
1. **Mdp partagé** (SHA-256 dans `settings.password_hash`) — accès lecture pour la promo
2. **Supabase magic-link** — accès admin (whitelist dans table `admins`)

**Identité** (tier 1) : prénom choisi au premier accès, stocké `localStorage.ecsr_who`, **figée** (pas de bouton "Changer").

| Action | Tier 1 | Admin |
|---|---|---|
| Lire tout | ✅ | ✅ |
| Ajouter passage (date ≤ J-2) | ✅ tracé | ✅ |
| Supprimer / modifier passage | ❌ | ✅ |
| Planning, Notes, Thèmes, Stagiaires/Profs CRUD, Whitelist | ❌ | ✅ |

## Sécurité (post-audit H1, livré 16 mai)

- **RLS strictes** : SELECT public + writes via `is_admin()` SECURITY DEFINER
- **Triggers audit** en SECURITY DEFINER, identité depuis `auth.jwt()->>email` (non forgeable serveur)
- **Tables `*_audit`** : aucun policy INSERT/UPDATE/DELETE direct
- **CSP** dans `index.html` (default-src 'self' + esm.sh + supabase.co)
- ⚠️ **Action manuelle pending** : verrouiller Supabase Dashboard > Auth > URL Configuration sur `https://watchi64.github.io/ecsr-promo/`

## Pages (8 onglets)

```
Accueil · Tableau de bord · Planning · Thèmes · Passages · Notes · Ressources · Paramètres
```

### Spécificités à connaître

- **Accueil** : hero 2 colonnes (texte/image panneaux FR `assets/images/panneaux-fr-banner.png` — 4.7 MB, à passer en WebP si lent)
- **Dashboard** : pill moyenne /20 par stagiaire, label "**Opportunité ratée**" (PAS "Peut attendre")
- **Planning** : jours empilés vertical, lanes horizontales côte à côte (refus assumé du 5-colonnes desktop), horaires/pause modulables, print PDF 1 page
- **Thèmes** : 4 sections en pills (Tout / Thèmes 57 / TP ECSR 12 / REMC 35 / Notions 2)
- **Passages** : INSERT contraint date ≥ J-2 pour non-admin (côté RLS + JS), bouton historique audit
- **Notes** : vue matrice UNIQUE (toggle Liste retiré), édition inline cellule (click → input, Enter sauve), date globale en toolbar
- **Paramètres** : Sécurité (mdp + admins + identité figée) / Apparence (6 thèmes complets + 4 accents) / Promo (admin only) / Infos

## Base de données — tables clés

- `stagiaires` (15 prénoms) : Audrick, Gaëlle, Céline, Mickael, Julie, Valentin, Gaël, Emilie, Rita, Lorie, Tatiana, Cassandre, Aurélie, Anissa, Timy
- `profs` : Hocine, Raphaël, Romain
- `admins` (table dédiée, PK email)
- `themes` : 57 officiels (type=theme, numero 1-57) + 12 compétences TP ECSR + 35 REMC + 2 notions (type=notion)
- `competences` : C1-C4 (TP ECSR) + REMC + MGDE (codes utilisables dans evaluations)
- `passages`, `passages_audit`, `evaluations`, `evaluations_audit`, `planning_entries`, `planning_half_meta`, `ressources`, `settings`

## Décisions UX importantes (à respecter)

- ❌ **Pas d'em-dashes (—)** dans les libellés UI. Régression à éviter.
- ✅ Identité figée après premier accès
- ✅ Layout planning vertical (pas 5-colonnes)
- ✅ Édition inline matrice Notes (pas de modal pour les saisies simples)
- ✅ Headers tableau matrice : titres rotatés vertical (-90°)
- ❌ Pas de gamification (badges, XP) — public adulte
- ❌ Pas de framework (React, Tailwind) — vanilla suffit

## Roadmap (non décidé)

**Repoussé après "ça marche parfaitement pour la promo" :**
- Émargement signature canvas + PDF (Qualiopi indicateur 11)
- Attestations + certificat réalisation format réglementaire
- Export BPF annuel
- Questionnaires satisfaction auto J+1 / J+180
- Cmd+K command palette
- PWA installable
- Realtime presence avatars
- Skeleton loaders
- Export CSV/PDF complet
- Multi-tenant (promo_id partout)
- Génération QCM auto via API Claude depuis les 57 thèmes (différenciant pitch ECF)
- Branding personnalisable par centre

## Comment travailler sur ce projet

1. **Toujours commit + push après chaque feature** (le user n'aime pas les pauses inutiles)
2. **Migrations Supabase via MCP `mcp__800314df`** (project_id `dacqponglpeuscbgwfqn`), pas en local
3. **Communication FR**, récap court après chaque livraison, tableaux markdown
4. **AskUserQuestion** uniquement pour les décisions structurantes (nouvelle table, refonte vue, choix d'archi)
5. **Vérifier `git log`** pour les derniers commits avant d'attaquer
