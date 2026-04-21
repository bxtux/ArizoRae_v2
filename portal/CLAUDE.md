# portal/ — Next.js 14 App Router

Frontend + BFF du service. Server components par défaut, Prisma pour la DB, NextAuth pour l'auth, Tailwind pour le styling (tokens portés du prototype `docs/ui-design/.../RAE UI Prototype.html`).

## Structure

```
portal/src/
├── app/
│   ├── (public)/              # login, signup, reset, verify, landing
│   ├── (auth)/                # routes protégées (middleware)
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── applications/
│   │   ├── settings/
│   │   └── stats/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── onboarding/start/
│       ├── scraper/run/
│       ├── offers/[id]/{apply,reject,interview}/
│       ├── chat/
│       ├── support/
│       ├── account/delete/
│       └── ws/                # SSE endpoints (streaming agent-worker)
├── components/
│   ├── rae-chat/              # chatbot flottant, persistant entre pages
│   ├── offer-card/
│   └── stepper/
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── auth.ts                # NextAuth config
│   ├── agent-client.ts        # HTTP wrapper vers agent-worker (header AGENT_WORKER_SECRET)
│   ├── celery-client.ts       # enqueue via redis
│   └── mail.ts                # SMTP send via nodemailer
├── middleware.ts              # protège (auth)/*
└── styles/
    ├── globals.css
    └── tokens.css             # variables CSS portées du prototype
```

## Conventions

- **Server components par défaut**. Ajouter `"use client"` uniquement pour interactivité réelle (form, state, listeners).
- **Server actions** pour mutations simples (form submit). API routes pour streaming SSE ou intégrations externes.
- **Prisma** : toujours via `lib/db.ts` (singleton), ne pas instancier ailleurs.
- **Auth** : récupérer session via `auth()` de NextAuth v5 dans server components ; `useSession()` côté client uniquement si strict besoin.
- **Rate limiting** : middleware Redis sur `/api/auth/*` (5 req / 15 min / IP).
- **Design tokens** : utiliser les variables CSS de `tokens.css` (`--primary`, `--bg`, etc.), pas de couleurs hardcodées.

## Intégration agent-worker

Toutes les requêtes passent par `lib/agent-client.ts` :

```ts
await agentClient.post('/workflows/analyse', { user_id, offer_id });
```

Le secret `AGENT_WORKER_SECRET` est injecté en header `X-Agent-Secret`. Ne jamais exposer l'URL interne de `agent-worker` au client : toujours proxy via Next API route si streaming SSE côté navigateur.

## Intégration Celery

`lib/celery-client.ts` enqueue des tâches via Redis :

```ts
await celery.enqueue('run_scraper_for_user', { user_id });
```

Implémentation basée sur lib `celery-ts` ou publication directe sur la queue Redis attendue par Celery (JSON `{task, id, args, kwargs}`).

## Styling

Variables du prototype à porter dans `tokens.css` :
```
--bg: #0e0a09 / --bg2: #170f0c / --bg3: #1f1512
--primary: #e85520 (orange)
--gold: #f5a520
--text: #f0ece8 / --muted: #8a7d77
--font: 'Space Grotesk' / --mono: 'Space Mono'
```

## Tests

- `npm run check` = type-check + lint
- `npm run test:e2e` = Playwright tests (parcours signup → onboarding → dashboard)
- Tests unitaires : Vitest pour `lib/*`

## Interdits

- Pas de `console.log` en prod (utiliser `pino` via `lib/logger.ts`).
- Pas de state global Redux/Zustand : server components + URL params + React context local.
- Pas de requête SQL brute (sauf migration manuelle justifiée).
