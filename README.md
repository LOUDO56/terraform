# S3 Platform — IaC, stockage chaud/froid, Next.js HTTPS & webhook de déploiement

Plateforme complète et **portable**, exécutable entièrement en local :

- **Terraform** provisionne un stockage objet S3 (buckets chaud + froid, versioning, réplication).
- **MinIO** fournit deux stockages S3-compatibles (chaud et froid).
- **Next.js** (HTTPS local `https://nextjs.local`) permet d'uploader, lister et restaurer des fichiers.
- **Caddy** termine le HTTPS avec une CA locale interne (aucun outil à installer).
- **Webhook** GitOps : un push sur `master` déclenche le redéploiement de l'app.

Aucun secret n'est stocké dans Git. Aucun cloud n'est requis pour valider le projet.

---

## 1. Architecture

```
                          https://nextjs.local
                                   │
        Navigateur ───────────────▼──────────────────┐
                              ┌─────────┐             │
                              │  Caddy  │  (HTTPS / CA interne)
                              └────┬────┘             │
                                   │ reverse_proxy    │
                              ┌────▼─────┐            │
                              │ Next.js  │  routes API server-side
                              │  :3000   │  (les clés S3 restent côté serveur)
                              └──┬────┬──┘
                     upload/list │    │ restore (GET froid → PUT chaud)
                              ┌──▼──┐ └──▼─────┐
                              │ HOT │ réplic.  │ COLD │
                              │minio│════════▶ │minio │
                              │-hot │ (MinIO)  │-cold │
                              └─────┘          └──────┘

   Webhook GitOps :  push master ──▶ POST /api/webhook ──▶ git pull + docker compose up --build
```

- **Chaud (`minio-hot`)** : bucket actif, alimenté par les uploads de l'app.
- **Froid (`minio-cold`)** : bucket de backup, alimenté par la **réplication native MinIO** configurée en Terraform.
- **Restaurer** : recopie le contenu du froid vers le chaud (écrasement, avec confirmation).

---

## 2. Prérequis

| Outil | Version | Rôle |
|-------|---------|------|
| Docker + plugin Compose | récent | MinIO, Next.js, Caddy |
| Terraform (ou OpenTofu) | >= 1.5 | IaC des buckets et de la réplication |
| Node.js | >= 18 | script de test du webhook (optionnel) |
| Navigateur / `curl` | — | accès à l'app |

Ports utilisés : `80`, `443` (Caddy), `9000`/`9001` (MinIO chaud), `9002`/`9003` (MinIO froid).

---

## 3. Démarrage (séquence complète)

Objectif : infra + app + HTTPS + upload/restore + webhook en quelques minutes.

**1. Copier les variables d'environnement**

```
cp .env.example .env
```

**2. Déclarer le domaine local**

```
echo "127.0.0.1 nextjs.local" | sudo tee -a /etc/hosts
```

(Windows : ajouter `127.0.0.1 nextjs.local` dans `C:\Windows\System32\drivers\etc\hosts`.)

**3. Lancer l'infrastructure et l'application**

```
docker compose up -d --build
```

Cela démarre les deux MinIO, l'application Next.js et Caddy.

**4. Provisionner les buckets et la réplication (Terraform)**

```
cd terraform
terraform init
terraform plan
terraform apply -auto-approve
cd ..
```

Outputs attendus : `hot_bucket`, `cold_bucket`, `hot_endpoint`, `cold_endpoint`, `region`.

**5. Ouvrir l'application**

```
curl -k https://nextjs.local
```

ou dans le navigateur : <https://nextjs.local> (voir §6 pour un cadenas « vert »).

**6. Tester upload → réplication → restore**

1. Uploader un fichier via le bouton **Upload**.
2. Vérifier qu'il apparaît dans la liste (bucket chaud).
3. La réplication vers le froid est automatique (délai asynchrone de quelques secondes). Console froid : <http://localhost:9003> (login `minioadmin` / `minioadmin`).
4. Cliquer **Restaurer depuis le froid** pour recopier le froid vers le chaud (confirmation demandée).

**7. Tester le webhook de déploiement**

```
node scripts/test-webhook.mjs
```

Réponse attendue : `HTTP 200 {"status":"deploy triggered","branch":"main"}`.

La branche qui déclenche le déploiement est configurable via `DEPLOY_BRANCH`
(`main` par défaut ici ; mettre `master` selon la convention du dépôt).

---

## 4. HTTPS local

Caddy émet automatiquement un certificat pour `nextjs.local` via sa **CA interne**
(`tls internal`). Aucun `mkcert` à installer.

- Accès immédiat en ligne de commande : `curl -k https://nextjs.local`.
- Pour un certificat approuvé par le navigateur (cadenas vert), importer la racine de la CA Caddy :

```
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

Puis ajouter `caddy-root.crt` au magasin de certificats de confiance du système / navigateur.

---

## 5. Bloc A — Terraform & S3

Dossier `terraform/` :

- `minio_s3_bucket.hot` / `minio_s3_bucket.cold` : bucket chaud et bucket froid.
- `minio_s3_bucket_versioning` : versioning activé (prérequis de la réplication).
- `minio_iam_policy` + `minio_iam_user` + `minio_iam_service_account` : identité de service utilisée par la réplication.
- `minio_s3_bucket_replication.hot_to_cold` : règle de réplication **chaud → froid** (objets existants inclus).
- `outputs.tf` : noms de buckets, endpoints, région (aucun secret en clair dans le state commité — le state est ignoré par Git).

Backend Terraform : `local` par défaut (voir `versions.tf`). Pour la prod, remplacer par un backend distant (`s3`, `http`, etc.).

Commandes :

```
cd terraform
terraform init
terraform plan
terraform apply
```

---

## 6. Bloc B — Application Next.js

Dossier `nextjs/` :

- **Upload** : `POST /api/files` — envoi multi-fichiers vers le bucket chaud, retour nom + taille.
- **Liste** : `GET /api/files` — objets du bucket chaud (nom, taille, date).
- **Restaurer** : `POST /api/restore` — recopie froid → chaud, avec confirmation côté UI.
- **Sécurité** : toutes les opérations S3 passent par les routes API server-side. Les clés ne sont **jamais** exposées au navigateur.

---

## 7. Bloc C — Webhook & GitOps

- Endpoint : `POST /api/webhook` (Route Handler Next.js).
- Sécurité : signature HMAC SHA-256 (`X-Hub-Signature-256`) validée avec `WEBHOOK_SECRET`.
- Action sur push de la branche `DEPLOY_BRANCH` (master/main) : `git pull` + `docker compose up -d --build nextjs`.
- Manifestes versionnés : dossier `gitops/` (flux décrit + unité systemd alternative).
- Test local sans hébergement : `node scripts/test-webhook.mjs`.

---

## 8. Provider agnostic — équivalences

| Composant local | Rôle | Équivalent cloud |
|-----------------|------|------------------|
| MinIO | Stockage objet S3 | AWS S3 · Scaleway Object Storage · GCS (mode interop S3) |
| Réplication MinIO | Chaud → froid | AWS S3 Replication · lifecycle vers Glacier |
| Terraform `aminueza/minio` | IaC des buckets | Terraform `hashicorp/aws` (mêmes ressources S3) |
| Caddy (`tls internal`) | Reverse proxy HTTPS | Traefik / Nginx + Let's Encrypt · ALB + ACM |
| Webhook Next.js | Déploiement GitOps | GitHub Actions · Argo CD · Flux |
| Docker Compose | Orchestration | Kubernetes · ECS |

L'application utilise le SDK AWS S3 standard : basculer vers un cloud se fait en
changeant les variables `S3_ENDPOINT`, `S3_REGION` et les identifiants dans `.env`.

---

## 9. Secrets

- Aucun secret dans Git. `.env` est ignoré ; seul `.env.example` est versionné.
- Pour la production, remplir les placeholders (`clé api prod à remplir`, etc.) dans un `.env` hors dépôt ou un gestionnaire de secrets.

---