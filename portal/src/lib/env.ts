import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PUBLIC_URL: z.string().url(),
  AUTH_SECRET_KEY: z.string().min(32),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CELERY_BROKER_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().email(),
  SMTP_FROM_NAME: z.string().default('ArizoRAE'),
  AGENT_WORKER_URL: z.string().url(),
  AGENT_WORKER_SECRET: z.string().min(16),
  GOTIFY_URL: z.string().url(),
  GOTIFY_ADMIN_TOKEN: z.string(),
});

type Env = z.infer<typeof schema>;

let _parsed: Env | undefined;
function parsed(): Env {
  // NEXT_PHASE is set during `next build` — skip validation, env vars unavailable then.
  if (process.env.NEXT_PHASE === 'phase-production-build') return {} as Env;
  if (!_parsed) _parsed = schema.parse(process.env);
  return _parsed;
}

export const env = new Proxy({} as Env, {
  get(_, key: PropertyKey) {
    if (typeof key === 'symbol') return undefined;
    return parsed()[key as keyof Env];
  },
});
