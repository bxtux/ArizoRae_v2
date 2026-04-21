import { env } from './env';

export async function agentPost<T = unknown>(
  path: string,
  body: unknown,
  opts: { stream?: boolean } = {}
): Promise<T | Response> {
  const res = await fetch(`${env.AGENT_WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': env.AGENT_WORKER_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && !opts.stream) {
    throw new Error(`Agent worker ${path} failed: ${res.status}`);
  }
  if (opts.stream) return res;
  return res.json() as Promise<T>;
}
