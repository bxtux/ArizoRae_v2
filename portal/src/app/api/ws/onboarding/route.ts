/**
 * SSE proxy: reads stored onboarding.json, POSTs to agent-worker /workflows/init
 * and streams the SSE response back to the browser.
 * The browser opens this as an EventSource (GET).
 */
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const uid = session.user.id;
  const configPath = join(USERS_DATAS_DIR, uid, 'onboarding.json');

  let onboardingConfig: { user_id: string; cv_path: string; metier: string; country: string };
  try {
    const raw = await readFile(configPath, 'utf-8');
    onboardingConfig = JSON.parse(raw);
  } catch {
    return new Response(
      'data: {"type":"error","message":"onboarding.json manquant — appelez /api/onboarding/start d\'abord"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  // POST to agent-worker /workflows/init (which is itself an SSE response)
  const upstream = await fetch(`${env.AGENT_WORKER_URL}/workflows/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': env.AGENT_WORKER_SECRET,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(onboardingConfig),
  });

  if (!upstream.ok || !upstream.body) {
    const err = JSON.stringify({
      type: 'error',
      message: upstream.status === 402
        ? 'Le mode standard est indisponible. Activez le mode economique pour continuer.'
        : `agent-worker: ${upstream.status}`,
      fallback_mode: upstream.status === 402 ? 'economic' : undefined,
    });
    return new Response(`data: ${err}\n\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
