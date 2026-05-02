# RUNBOOK ArizoRAE V2

Procédures opérationnelles pour administrer, dépanner et restaurer le service.

## Table des matières

0. [Premier démarrage](#0-premier-démarrage)
1. [Démarrage et arrêt](#1-démarrage-et-arrêt)
2. [Vérification de la santé](#2-vérification-de-la-santé)
3. [Rotation des secrets](#3-rotation-des-secrets)
4. [Backup et restauration Postgres](#4-backup-et-restauration-postgres)
5. [Archives utilisateurs](#5-archives-utilisateurs)
6. [Mise à jour du stack](#6-mise-à-jour-du-stack)
7. [Incidents fréquents](#7-incidents-fréquents)
8. [Escalade Gotify](#8-escalade-gotify)

---

## 0. Premier démarrage

Après un `docker compose up -d` initial, la DB est **vide** — aucun compte n'existe.

### Créer le premier compte (flow normal)

1. Ouvrir `https://<DOMAIN>/signup`
2. Remplir le formulaire (email + mot de passe ≥ 8 caractères)
3. Un email de vérification est envoyé via SMTP — cliquer sur le lien
4. Se connecter sur `https://<DOMAIN>/login`

> Le login est bloqué tant que `email_verified_at` est NULL. Si l'email ne reçoit pas le lien, vérifier les spams ou consulter les logs : `docker compose logs portal | grep -i mail`

### Vérifier que le SMTP est opérationnel avant l'inscription

```bash
docker compose exec portal node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.verify().then(() => console.log('SMTP OK')).catch(e => console.error('SMTP ERROR:', e.message));
"
```

### Bypass email verification (urgence / dev)

Si le SMTP n'est pas encore configuré, vérifier manuellement en DB après l'inscription :

```bash
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB \
  -c "UPDATE users SET email_verified_at = NOW() WHERE email = 'ton@email.com';"
```

---

## 1. Démarrage et arrêt

```bash
# Démarrage normal
cd /chemin/vers/ArizoRae_v2/infra
docker compose up -d

# Avec ngrok (CGNAT, dev)
docker compose --profile ngrok up -d

# Arrêt propre (données conservées)
docker compose down

# Arrêt + suppression des volumes (DESTRUCTIF — efface DB et Redis)
docker compose down -v
```

Ordre de démarrage géré par `depends_on` : postgres → redis → portal/agent/scraper/beat.

---

## 2. Vérification de la santé

```bash
# Statut de tous les services
docker compose ps

# Logs d'un service (100 dernières lignes)
docker compose logs --tail=100 portal
docker compose logs --tail=100 agent
docker compose logs --tail=100 scraper

# Healthcheck postgres
docker compose exec postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB

# Healthcheck redis
docker compose exec redis redis-cli ping

# API agent-worker
curl -s http://localhost:8000/health   # depuis le host si port exposé
# ou depuis un autre conteneur :
docker compose exec portal curl -s http://agent:8000/health
```

---

## 3. Rotation des secrets

### AUTH_SECRET_KEY (signe les cookies + chiffre les clés Anthropic et OpenAI user)

**Attention** : changer cette clé invalide toutes les sessions actives ET rend illisibles les clés Anthropic **et OpenAI** utilisateurs chiffrées (champs `anthropic_key_encrypted` et `openai_key_encrypted`).

Procédure :
1. Générer une nouvelle clé : `openssl rand -base64 48`
2. Mettre à jour `.env` : `AUTH_SECRET_KEY=<nouvelle_clé>`
3. Vider les champs de clés chiffrées pour tous les utilisateurs (ils devront resaisir leurs clés) :
   ```sql
   UPDATE users SET anthropic_key_encrypted = NULL, openai_key_encrypted = NULL;
   ```
4. `docker compose up -d portal` pour recharger.

### AGENT_WORKER_SECRET

1. Générer : `openssl rand -hex 32`
2. Mettre à jour `.env` : `AGENT_WORKER_SECRET=<nouveau_secret>`
3. Redémarrer portal et agent : `docker compose up -d portal agent`

### ANTHROPIC_API_KEY_ADMIN

1. Révoquer l'ancienne clé sur `console.anthropic.com`.
2. Mettre à jour `.env` : `ANTHROPIC_API_KEY_ADMIN=<nouvelle_clé>`
3. `docker compose up -d agent`

### OPENAI_API_KEY_ADMIN

1. Révoquer l'ancienne clé sur `platform.openai.com`.
2. Mettre à jour `.env` : `OPENAI_API_KEY_ADMIN=<nouvelle_clé>`
3. `docker compose up -d agent`

---

## 4. Backup et restauration Postgres

### Backup manuel

```bash
# Dump complet (schéma + données)
docker compose exec -T postgres pg_dump \
  -U $POSTGRES_USER $POSTGRES_DB \
  > backups/arizorae_$(date +%Y%m%dT%H%M%S).sql

# Dump compressé
docker compose exec -T postgres pg_dump \
  -U $POSTGRES_USER $POSTGRES_DB -Fc \
  > backups/arizorae_$(date +%Y%m%dT%H%M%S).dump
```

### Restauration

```bash
# Depuis un dump SQL
cat backups/arizorae_TIMESTAMP.sql | \
  docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB

# Depuis un dump binaire (-Fc)
docker compose exec -T postgres pg_restore \
  -U $POSTGRES_USER -d $POSTGRES_DB < backups/arizorae_TIMESTAMP.dump
```

### Backup automatique quotidien (Celery Beat)

Le beat_task `backup_postgres` tourne à 03h00 UTC chaque nuit et stocke dans `infra/backups/`.
Rétention : 7 jours (les fichiers > 7 j sont supprimés automatiquement par la tâche).

Pour vérifier que les backups tournent :
```bash
docker compose logs --tail=50 beat | grep backup
ls -lh infra/backups/
```

> **⚠️ Limitation** : seule la base Postgres est sauvegardée automatiquement. Le dossier `infra/users_datas/` (CV, FACTS, scraper.py, outputs) n'est **pas** inclus dans les backups automatiques. Pour un backup complet, effectuer manuellement :
> ```bash
> tar -czf users_datas_$(date +%Y%m%dT%H%M%S).tar.gz infra/users_datas/ --exclude='infra/users_datas/.trash'
> ```

---

## 5. Archives utilisateurs

Quand un compte est supprimé, la tâche Celery `archive_user_data` déplace `users_datas/<uid>/` vers `users_datas/.trash/<uid>_<timestamp>/`.

### Purge manuelle des archives

```bash
# Lister les archives
ls -lh infra/users_datas/.trash/

# Supprimer les archives > 30 jours
find infra/users_datas/.trash/ -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
```

### Restaurer les données d'un utilisateur

```bash
# Identifier l'archive
ls infra/users_datas/.trash/ | grep <user_id_partiel>

# Restaurer
mv infra/users_datas/.trash/<uid>_<timestamp>/ infra/users_datas/<uid>/

# Remettre deletedAt à NULL en DB
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB \
  -c "UPDATE users SET deleted_at = NULL WHERE id = '<uuid>';"
```

---

## 6. Mise à jour du stack

### Rebuild d'un seul service après modif code

```bash
docker compose build portal
docker compose up -d portal
```

### Migration Prisma (après ajout de colonnes/tables)

```bash
# Générer et appliquer en dev
docker compose exec portal npx prisma migrate dev --name <nom_descriptif>

# Appliquer en production (migrations déjà générées)
docker compose exec portal npx prisma migrate deploy
```

### Mise à jour des images de base

```bash
docker compose pull postgres redis gotify
docker compose up -d postgres redis gotify
```

---

## 7. Incidents fréquents

### Impossible de se connecter (page login, aucune erreur ou "identifiants invalides")

Causes possibles dans l'ordre :

1. **DB vide** — aucun compte créé. Vérifier : `docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB -c "SELECT count(*) FROM users;"`
   → Si `0`, suivre la section [0. Premier démarrage](#0-premier-démarrage).

2. **Email non vérifié** — `email_verified_at` est NULL. NextAuth retourne `null` sans message d'erreur explicite.
   ```bash
   docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB \
     -c "SELECT email, email_verified_at FROM users WHERE email = 'ton@email.com';"
   ```
   Si NULL, cliquer sur le lien reçu par mail ou appliquer le bypass dev ci-dessus.

3. **Mot de passe incorrect** — bcrypt compare échoue silencieusement. Réinitialiser via `/reset` ou forcer un nouveau hash en DB.

4. **Compte supprimé** — `deleted_at` non NULL → compte soft-deleted. Le rétablir si nécessaire (voir section [5](#5-archives-utilisateurs)).

### Portal ne répond pas (502)

1. `docker compose ps portal` → vérifier `Up`
2. `docker compose logs --tail=50 portal` → chercher erreur démarrage
3. Causes fréquentes :
   - `DATABASE_URL` invalide → vérifier `.env`
   - `AGENT_WORKER_URL` non joignable → `docker compose logs agent`
   - Build cassé → `docker compose build portal && docker compose up -d portal`

### Agent-worker retourne 402

Quota épuisé pour un utilisateur et pas de clé Anthropic personnelle.
- Vérifier dans la DB : `SELECT email, quota_used_tokens, quota_limit_tokens FROM users WHERE id = '<uuid>';`
- Augmenter le quota temporairement : `UPDATE users SET quota_limit_tokens = 1000000 WHERE id = '<uuid>';`
- Ou demander à l'utilisateur de configurer sa clé dans `/settings`.

### Scraper échoue pour un user

1. Consulter le log : `cat infra/users_datas/<uid>/scraper.log`
2. Vérifier que `scraper.py` existe et est valide syntaxiquement :
   ```bash
   docker compose exec scraper python -c "import ast; ast.parse(open('/users_datas/<uid>/scraper.py').read())"
   ```
3. Régénérer le scraper si corrompu : appeler `POST /scraper/generate` via l'agent-worker.
4. Voir `skills/arizorae-debug-scraper/SKILL.md` pour la procédure complète.

### Redis OOM (mémoire saturée)

```bash
docker compose exec redis redis-cli info memory
# Si used_memory_human > 512M :
docker compose exec redis redis-cli flushdb  # DESTRUCTIF — efface toutes les queues Celery en attente
```

### Certificat TLS expiré

Caddy renouvelle automatiquement via DuckDNS. Si problème :
1. `docker compose logs caddy | grep -i cert`
2. Vérifier que `DUCKDNS_TOKEN` est valide : `curl "https://www.duckdns.org/update?domains=$DUCKDNS_SUBDOMAIN&token=$DUCKDNS_TOKEN&ip="`
3. Forcer le renouvellement : `docker compose restart caddy`

---

## 8. Escalade Gotify

Les alertes admin arrivent sur Gotify (`https://<DOMAIN>/gotify`).

Priorités :
- `5` : support utilisateur (ticket soumis)
- `8` : erreur critique (à venir)

Accès web : `https://<DOMAIN>/gotify` avec les credentials admin définis dans `infra/gotify/config.yml`.
