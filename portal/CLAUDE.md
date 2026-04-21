# portal/ — Next.js 14 App Router

Frontend + BFF du service. Server components par défaut, Prisma pour la DB, NextAuth pour l'auth, Tailwind pour le styling (tokens portés du prototype `docs/ui-design/.../RAE UI Prototype.html`).

## Structure

```
portal/src/
├── app/
│   ├── (public)/              # login, signup, signup/sent, reset, reset/confirm, verify
│   ├── (auth)/                # routes protégées (middleware)
│   │   ├── onboarding/        # upload CV + streaming SSE init + aperçu démo
│   │   ├── dashboard/         # liste offres new, OfferActions (Postuler/Rejeter/Entretien)
│   │   ├── applications/      # offres applied + liens CV/lettre
│   │   ├── settings/          # fréquence mail, clé Anthropic, support, suppression compte
│   │   └── stats/             # offres scrapées/postulées, quota tokens, derniers ai_jobs
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── onboarding/cv/      # POST : upload fichier PDF
│       ├── onboarding/start/   # POST : enqueue Celery onboard_user
│       ├── ws/onboarding/      # GET SSE : tail agent-worker /workflows/init
│       ├── scraper/demo/       # POST : enqueue run_scraper_demo
│       ├── scraper/run/        # POST : enqueue run_scraper_for_user
│       ├── offers/[id]/apply/
│       ├── offers/[id]/reject/
│       ├── offers/[id]/interview/
│       ├── chat/               # POST : message → agent-worker /chat + persist DB
│       ├── chat/history/       # GET : 50 derniers chat_messages (chargé par RaeChat)
│       ├── support/            # POST : insert support_ticket + Gotify
│       └── account/delete/     # DELETE : soft-delete + enqueue archive_user_data
├── components/
│   ├── rae-chat/               # chatbot flottant, monté dans root layout, historique chargé depuis DB
│   └── quota-modal/            # modal quota dépassé (rendu SSR dans layout)
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── auth.ts                # NextAuth v5, strategy database, provider Credentials
│   ├── agent-client.ts        # agentPost() — wrapper fetch vers agent:8000, header X-Agent-Secret
│   ├── celery-client.ts       # enqueueCelery(task, args) — publication sur queue Redis
│   ├── crypto.ts              # encryptApiKey / decryptApiKey — AES-256-GCM, clé dérivée d'AUTH_SECRET_KEY
│   ├── gotify.ts              # notifyAdmin() — POST Gotify
│   ├── mail.ts                # sendMail() — nodemailer SMTP
│   └── env.ts                 # validation Zod des variables d'env au démarrage
├── middleware.ts              # protège /dashboard, /onboarding, /applications, /settings, /stats
├── types/next-auth.d.ts       # augmentation session.user.id
└── tests/
    └── e2e/                   # Playwright (playwright.config.ts à la racine portal/)
        ├── auth.spec.ts        # redirections, pages publiques accessibles
        └── signup-onboarding.spec.ts
```

## Conventions

- **Server components par défaut**. `"use client"` uniquement pour interactivité réelle : form stateful, hooks, event listeners.
- **Server actions** pour mutations simples (form submit). API routes pour : streaming SSE, webhooks, ou appels devant rester côté serveur mais appelés depuis le client (chat, scraper run).
- **Prisma** : toujours via `lib/db.ts` (singleton), ne pas instancier ailleurs.
- **Auth** : `auth()` de NextAuth v5 dans server components ; `useSession()` côté client si strict besoin.
- **Design tokens** : variables CSS de `globals.css` (`--primary`, `--bg`, `--gold`, etc.), pas de couleurs hardcodées.

## Intégration agent-worker

Toutes les requêtes IA passent par `lib/agent-client.ts` :

```ts
import { agentPost } from '@/lib/agent-client';
const result = await agentPost<{ reply: string }>('/chat', { user_id, message });
```

Le secret `AGENT_WORKER_SECRET` est injecté en header `X-Agent-Secret`. Ne jamais exposer l'URL interne `AGENT_WORKER_URL` au client — toujours proxy via Next API route.

## Intégration Celery

`lib/celery-client.ts` enqueue via Redis directement (format envelope Celery 4) :

```ts
import { enqueueCelery } from '@/lib/celery-client';
await enqueueCelery('app.tasks.run_scraper_for_user', [userId]);
await enqueueCelery('app.tasks.archive_user_data', [userId]);
```

## Chiffrement clé Anthropic user

`lib/crypto.ts` chiffre/déchiffre la clé Anthropic personnelle de l'utilisateur avec AES-256-GCM. La clé de chiffrement est dérivée de `AUTH_SECRET_KEY` via SHA-256. **Rotation de `AUTH_SECRET_KEY` = invalide toutes les clés Anthropic chiffrées en DB** (voir RUNBOOK).

## Modal quota dépassé

`components/quota-modal/QuotaModal.tsx` est un client component monté dans `app/layout.tsx`. La vérification `quotaUsedTokens >= quotaLimitTokens && !anthropicKeyEncrypted` se fait côté serveur dans le layout — pas de fetch client. Le modal renvoie vers `/settings#anthropic-key`.

## Styling

Variables CSS dans `globals.css` (portées du prototype `docs/ui-design/`) :
```
--bg: #0e0a09  --bg2: #170f0c  --bg3: #1f1512
--primary: #e85520 (orange)    --gold: #f5a520
--text: #f0ece8                --muted: #8a7d77
--font: 'Space Grotesk'        --mono: 'Space Mono'
```

Classes utilitaires : `.glass`, `.btn-primary`, `.btn-ghost`, `.input`.

## Tests

```bash
# Type-check + lint
npm run check

# Tests e2e Playwright (nécessite stack running sur localhost:3000)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# Ou via docker compose
docker compose exec portal npx playwright test
```

Config dans `portal/playwright.config.ts`. Fichiers de test dans `portal/tests/e2e/`.

## Interdits

- Pas de `console.log` en prod — utiliser `structlog` ou `pino` si besoin de logs.
- Pas de state global Redux/Zustand : server components + URL params + React context local.
- Pas de requête SQL brute — Prisma uniquement.
- Pas d'appel direct à l'API Anthropic depuis le portal — tout via `agentPost()`.
