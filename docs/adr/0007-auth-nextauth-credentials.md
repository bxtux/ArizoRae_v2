# ADR 0007 — Authentification : NextAuth Credentials + Email

Statut : accepté
Date : 2026-04-21

## Contexte

Besoin d'inscription par email + mot de passe, vérification email, reset password, sessions sécurisées. SMTP déjà configuré dans `.env` (Gmail app password).

## Décision

**NextAuth.js** (v5, nommage `auth.js` side) avec deux providers combinés :

- **Credentials** : email + password, hash bcrypt (12 rounds), stockage dans `users.password_hash`.
- **Email (magic link)** : utilisé uniquement pour vérification initiale et reset password (pas pour login récurrent).

Sessions en base (`sessions` table Prisma), cookie HttpOnly + Secure + SameSite=Lax.

## Flux

### Inscription
1. `POST /api/auth/signup` body `{email, first_name, password}` → validation + bcrypt → insert `users` (unverified).
2. Génère `email_verification_tokens` (UUID, expire 24h).
3. Envoie mail SMTP avec lien `https://${DOMAIN}/verify?token=<t>`.

### Vérification
1. `GET /verify?token=…` → trouve token, pas expiré → `users.email_verified_at = now()`, supprime token.
2. Redirect `/onboarding`.

### Login
1. `POST /api/auth/callback/credentials` body `{email, password}` → compare bcrypt.
2. Rejette si `email_verified_at` null → message "vérifiez votre mail".
3. Rejette si `deleted_at` not null.
4. Crée row `sessions` + set cookie.

### Reset password
1. `POST /api/auth/reset-request` body `{email}` → génère `password_reset_tokens` (expire 1h) → mail avec lien.
2. `POST /api/auth/reset-confirm` body `{token, new_password}` → update `password_hash`, supprime token.

## Alternatives considérées

- **Lucia-auth** : plus léger mais plus de code boilerplate, moins d'intégrations (OAuth futur).
- **Clerk/Supabase Auth** : rapide mais dépendance externe, inadapté pour auto-hébergement.

## Règles

- **Jamais** de session JWT côté client en tant que source unique : toujours vérifier en DB via `sessions` table.
- `AUTH_SECRET_KEY` du `.env` utilisé pour signer les cookies et chiffrer `users.anthropic_key_encrypted`.
- Rate limiting sur `/api/auth/*` (middleware Next, Redis : 5 tentatives / 15 min / IP).

## Conséquences

- `portal/prisma/schema.prisma` contient les tables NextAuth (users, accounts, sessions, verification_tokens).
- Middleware `portal/src/middleware.ts` protège toutes les routes `(auth)/*`.
- Tests : un test e2e Playwright couvre signup → verify → login → logout.
