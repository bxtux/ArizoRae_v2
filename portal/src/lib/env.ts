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

export const env = schema.parse(process.env);
