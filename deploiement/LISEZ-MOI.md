# Mise en ligne de l'app (Scaleway)

## Comment ça marche

```
git push origin main
  → GitHub Actions (.github/workflows/mise-en-ligne.yml, environ 2 minutes)
      1. outils/deployer/preparer.mjs : copie les seuls fichiers servis dans _site/ (environ 650)
      2. envoi dans le bucket Scaleway (Object Storage, Paris)
      3. purge complète du cache d'Edge Services
      4. outils/deployer/verifier_en_ligne.mjs : le jeton ?v= servi égale celui du commit, sur le
         point d'accès Scaleway (<pipeline>.svc.edge.scw.cloud), puis sur app.jalonya.fr dès que
         le DNS la connaît
  → navigateur ← Edge Services (domaine, certificat, cache) ← bucket en mode « site web »
```

- **Fichiers servis** : `index.html`, `manifest.webmanifest`, `404.html`, `js/`, `css/`, `assets/`, `vendor/`.
  Rien d'autre : `docs/`, `supabase/`, `tests/`, `outils/`, `scripts/`, `sources/`, les notes et le banc
  (`_*`) ne quittent pas le dépôt. Le script s'arrête si un module servi importe un fichier non servi,
  si index.html ou le manifeste citent un fichier absent, ou si un motif de secret apparaît.
- **Réglages** : `deploiement/site.json`. C'est le **seul endroit** où l'adresse de l'app est écrite
  (`https://app.jalonya.fr/` depuis le 22/11/2026).
  L'app elle-même calcule son adresse depuis la page ouverte (`js/adresse.js`).
- **Clés** : secrets du dépôt GitHub `SCW_ACCESS_KEY` et `SCW_SECRET_KEY` (application IAM
  « mise-en-ligne-github », droits limités au projet). Jamais dans le dépôt ni dans un `.env`.
- **Réglage absent** (site.json vide, secret manquant) : l'Action finit en vert avec un avis, sans rien
  envoyer.
- **Cache** : pages HTML et manifeste en `no-cache` (revalidés à chaque visite) ; le reste 10 minutes
  (comme GitHub Pages). Modules et feuilles de style changent d'adresse à chaque version (`?v=`).
  Purge complète à chaque mise en ligne, car Edge Services ne documente pas si le `?v=` entre dans sa
  clé de cache.
- **Coût des minutes** : dépôt privé sur compte gratuit = 2 000 minutes d'Actions par mois ; une mise en
  ligne en prend 1 à 2, et main reçoit une centaine de poussées par mois au plus.

## Gestes courants

| Besoin | Geste |
|---|---|
| Voir si la mise en ligne a réussi | Onglet Actions du dépôt, « Mise en ligne » : vert = l'adresse sert le commit |
| Relancer sans nouveau commit | Actions, « Mise en ligne », « Run workflow » sur main |
| Vérifier à la main | `node outils/deployer/verifier_en_ligne.mjs` (lit l'adresse de site.json) |
| Lister à blanc ce qui part | `node outils/deployer/preparer.mjs --liste` |
| Ajouter un dossier servi | `DOSSIERS_SERVIS` dans `outils/deployer/preparer.mjs`, et son test |
| Changer d'adresse | `deploiement/site.json`, puis la liste de contrôle ci-dessous |

## Brancher une adresse (app.jalonya.fr, ou une autre plus tard)

1. Infomaniak : enregistrement CNAME du sous-domaine vers `<pipeline>.svc.edge.scw.cloud.` (un sous-domaine
   obligatoirement : Edge Services refuse un domaine nu).
2. Scaleway, Edge Services, pipeline, « Configure domain » : le sous-domaine, « Verify CNAME », certificat
   Let's Encrypt géré.
3. `deploiement/site.json` : `adresse` avec la barre finale. Commit, fusion.
4. Supabase, Authentication, URL Configuration : Redirect URLs : ajouter `https://<adresse>/**` ; le jour
   de la coupure, Site URL = la nouvelle adresse (barre finale) ; garder l'ancienne trois semaines.
5. `python scripts/guide-pdf.py` : régénère le PDF du guide CCP2 avec la nouvelle adresse en pied de page.
6. Dépôt public de redirection `watchi64/ecsr-promo` : `node outils/deployer/redirection.mjs --sortie <dossier>`
   puis pousser ses deux pages.
7. Table `ressources` : les liens qui citent l'ancienne adresse.

## Modèle d'e-mail « Reset password » (Supabase)

Le lien n'est plus écrit en dur : il reprend l'adresse de la page où la demande a été faite.

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a>
```

`{{ .RedirectTo }}` vaut `adresseApp()` (toujours terminée par `/`) si elle figure dans les Redirect
URLs, sinon la Site URL : d'où la barre finale exigée dans la Site URL.

## Politique du bucket

Activer le mode « site web » pose une politique par défaut ; dès qu'une politique existe, **seuls les
principaux qu'elle nomme** peuvent écrire, même avec les bons droits IAM. La politique à coller
(console, Object Storage, onglet Bucket policies, éditeur JSON, case « Maintain access to bucket »
cochée) :

```json
{
  "Version": "2023-04-17",
  "Id": "site-app",
  "Statement": [
    {
      "Sid": "LecturePubliqueDuSite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["NOM_DU_BUCKET/*"]
    },
    {
      "Sid": "MiseEnLigneParGitHub",
      "Effect": "Allow",
      "Principal": { "SCW": "application_id:ID_DE_L_APPLICATION" },
      "Action": ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["NOM_DU_BUCKET", "NOM_DU_BUCKET/*"]
    }
  ]
}
```
