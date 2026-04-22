import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { env } from '@/lib/env';
import { getEconomicSessionStatus } from '@/lib/economic';

export const dynamic = 'force-dynamic';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const econ = await getEconomicSessionStatus(session.user.id);
  if (!econ.connected) {
    return new Response(
      'data: {"type":"error","message":"Connexion OpenAI requise pour le mode économique."}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) {
    return new Response(
      'data: {"type":"error","message":"runId manquant"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  const runDir = join(USERS_DATAS_DIR, session.user.id, 'economic_runs', runId);
  const runPath = join(runDir, 'run.json');

  let run: {
    metier: string;
    country: string;
    confirm_replace: boolean;
    paths: { cv_path: string; outputs_dir: string };
  };
  try {
    run = JSON.parse(await readFile(runPath, 'utf-8'));
  } catch {
    return new Response(
      'data: {"type":"error","message":"run introuvable"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  await writeFile(runPath, JSON.stringify({ ...run, status: 'running', started_at: new Date().toISOString() }, null, 2));

  const upstream = await fetch(`${env.AGENT_WORKER_URL}/workflows/economic/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': env.AGENT_WORKER_SECRET,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      user_id: session.user.id,
      run_id: runId,
      cv_path: run.paths.cv_path,
      metier: run.metier,
      country: run.country,
      output_dir: run.paths.outputs_dir,
      confirm_replace: run.confirm_replace,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = JSON.stringify({
      type: 'error',
      message: `agent-worker: ${upstream.status}`,
      fallback_mode: 'economic',
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
