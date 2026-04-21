# ADR 0007 — Authentification : NextAuth Credentials + Email

Statut : accepté
Date : 2026-04-21

## Contexte

Besoin d'inscription par email + mot de passe, vérification email, reset password, sessions sécurisées. SMTP déjà configuré dans `.env` (Gmail app password).

## Décision

**NextAuth.js** (v5) avec un seul provider actif :

- **Credentials** : email + password, hash bcrypt (12 rounds), stockage dans `users.password_hash`. Seul provider dans `lib/auth.ts`.
- La vérification email et le reset password sont des **routes custom** (server actions dans `/signup/page.tsx` et API routes `/verify`, `/reset/confirm`) — pas un provider NextAuth Email.

Sessions en base (`sessions` table Prisma), cookie HttpOnly + Secure + SameSite=Lax. `trustHost: true` activé (requis derrière Caddy — voir M7).

## Flux

### Inscription
1. Server action dans `(public)/signup/page.tsx` : validation Zod + bcrypt → insert `users` (unverified).
2. Génère `email_verification_tokens` (UUID, expire 24h).
3. Envoie mail SMTP avec lien `https://${PUBLIC_URL}/verify?token=<t>`. SMTP failure catch-ed (compte créé même si mail échoue).

### Vérification
1. `GET /verify?token=…` → trouve token, pas expiré → `users.email_verified_at = now()`, supprime token.
2. Redirect `/login`.

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
- `AUTH_SECRET_KEY` du `.env` utilisé pour signer les cookies NextAuth et chiffrer `users.anthropic_key_encrypted` (AES-256-GCM, voir `lib/crypto.ts`).
- `trustHost: true` dans `lib/auth.ts` — obligatoire derrière Caddy (reverse proxy).
- **Non implémenté** : rate limiting sur `/api/auth/*`. À ajouter si exposition publique intensive.

## Conséquences

- `portal/prisma/schema.prisma` contient les tables NextAuth (`users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`).
- Middleware `portal/src/middleware.ts` protège toutes les routes `(auth)/*`. Toutes les pages `(auth)/` ont également un server component qui appelle `auth()` + `redirect('/login')` (défense en profondeur).
- Tests : `tests/e2e/auth.spec.ts` couvre redirections protégées + pages publiques ; `tests/e2e/signup-onboarding.spec.ts` couvre signup + login invalide.
