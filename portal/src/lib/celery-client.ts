import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { env } from './env';

let _redis: Redis | undefined;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(env.CELERY_BROKER_URL);
  return _redis;
}

export async function enqueueCelery(task: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) {
  const id = randomUUID();
  const body = [args, kwargs, { callbacks: null, errbacks: null, chain: null, chord: null }];
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64');
  const envelope = {
    body: encoded,
    'content-encoding': 'utf-8',
    'content-type': 'application/json',
    headers: {
      lang: 'py',
      task,
      id,
      root_id: id,
      parent_id: null,
      group: null,
    },
    properties: {
      correlation_id: id,
      reply_to: '',
      delivery_mode: 2,
      delivery_info: { exchange: '', routing_key: 'celery' },
      priority: 0,
      body_encoding: 'base64',
      delivery_tag: id,
    },
  };
  await getRedis().lpush('celery', JSON.stringify(envelope));
  return id;
}
