import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEconomicSessionStatus } from '@/lib/economic';
import { mkdir, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const econ = await getEconomicSessionStatus(session.user.id);
  if (!econ.connected) {
    return NextResponse.json({ error: 'economic_session_required' }, { status: 403 });
  }

  const fd = await req.formData();
  const cv = fd.get('cv') as File | null;
  const metier = String(fd.get('metier') || '').trim();
  const country = String(fd.get('country') || '').trim();
  const confirmReplace = String(fd.get('confirmReplace') || '') === 'true';

  if (!cv || cv.type !== 'application/pdf' || !metier || !country) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const userDir = join(USERS_DATAS_DIR, session.user.id);
  const existingProfile =
    (await exists(join(userDir, 'FACTS.md'))) || (await exists(join(userDir, 'BULLET_LIBRARY.md')));

  if (existingProfile && !confirmReplace) {
    return NextResponse.json({ error: 'profile_exists', requiresConfirmation: true }, { status: 409 });
  }

  const runId = randomUUID();
  const runDir = join(userDir, 'economic_runs', runId);
  const inputsDir = join(runDir, 'inputs');
  const outputsDir = join(runDir, 'outputs');
  const logsDir = join(runDir, 'logs');
  await mkdir(inputsDir, { recursive: true });
  await mkdir(outputsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const cvPath = join(inputsDir, 'cv_original.pdf');
  await writeFile(cvPath, Buffer.from(await cv.arrayBuffer()));

  const manifest = {
    run_id: runId,
    user_id: session.user.id,
    mode: 'economic',
    status: 'created',
    metier,
    country,
    confirm_replace: confirmReplace,
    created_at: new Date().toISOString(),
    paths: {
      run_dir: runDir,
      cv_path: cvPath,
      outputs_dir: outputsDir,
      logs_dir: logsDir,
    },
  };

  await writeFile(join(runDir, 'run.json'), JSON.stringify(manifest, null, 2));
  return NextResponse.json({ ok: true, runId });
}
