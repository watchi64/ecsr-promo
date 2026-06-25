# DEV.md — Workflow de développement

But : développer en local, valider, puis déployer **seulement quand c'est sûr**.

> **Règle d'or :** un commit reste sur ton PC. Seul `git push origin main`
> met en ligne (GitHub Pages déploie la branche `main`).

## 1. Lancer la preview locale

```powershell
.\dev.ps1
```
(équivaut à `python -m http.server 8000`)

- PC : http://localhost:8000
- Téléphone (même wifi) : `http://<ip-du-pc>:8000` (l'IP s'affiche au lancement)

⚠️ La preview tape la **base Supabase de PROD** (l'URL est dans `js/config.js`).
Lecture / validation visuelle = sûr. Les **écritures** de test modifient les vraies données.

## 2. Modifier et rafraîchir

Édite les fichiers, recharge le navigateur (pas de build).
Garde la console DevTools ouverte avec « Disable cache » pour éviter le cache des modules.

## 3. Relire le diff avant de figer

```powershell
git diff
```
ou le panneau Source Control de VS Code (diff visuel).

## 4. Commit (autant de fois que tu veux, ça reste local)

```powershell
git add -A
git commit -m "..."
```
Le hook `.githooks/pre-commit` re-versionne le cache-bust automatiquement.

## 5. Déployer quand validé

```powershell
git push origin main
```
GitHub Pages déploie en 1 à 2 min sur https://watchi64.github.io/ecsr-promo/

---

## Pour un changement risqué : la branche `dev`

```powershell
git switch -c dev
# ... commits ...
git push origin dev      # ouvre ensuite une PR sur GitHub pour relire le diff
```
Le merge de `dev` vers `main` = déploiement. `main` reste toujours la version qui marche.
