# GitOps — déploiement de l'application

Le déploiement est piloté par un webhook exposé par l'application Next.js
(`POST /api/webhook`). À chaque push sur la branche `master`, l'endpoint :

1. vérifie la signature HMAC SHA-256 (`X-Hub-Signature-256`) avec `WEBHOOK_SECRET` ;
2. vérifie que le `ref` du payload correspond à `refs/heads/master` ;
3. exécute la séquence de déploiement :
   - `git fetch --all --prune`
   - `git checkout master`
   - `git pull --ff-only origin master`
   - `docker compose up -d --build nextjs`

Le dépôt est monté dans le conteneur `nextjs` sur `/workspace`, et le socket
Docker de l'hôte (`/var/run/docker.sock`) est monté pour permettre le rebuild.

## Fichiers de ce dossier

- `nextjs.service` : unité systemd (alternative « bare metal » au conteneur, si
  l'application tourne directement sur l'hôte via `npm run start`).

## Brancher un vrai dépôt Git

Sur GitHub/GitLab, créer un webhook :

- URL : `https://<votre-hote>/api/webhook`
- Content type : `application/json`
- Secret : la valeur de `WEBHOOK_SECRET`
- Évènement : `push`

## Test en local (sans héberger le dépôt)

```
node scripts/test-webhook.mjs
```

Le script calcule la signature HMAC et envoie un payload d'exemple
(`refs/heads/master`) à l'endpoint local.
