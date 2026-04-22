import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { join } from 'path';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

async function safeRead(path: string) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const base = join(USERS_DATAS_DIR, session.user.id);
  const facts = await safeRead(join(base, 'FACTS.md'));
  const bullets = await safeRead(join(base, 'BULLET_LIBRARY.md'));
  const preset = await safeRead(join(base, 'preset.md'));

  return NextResponse.json({
    facts,
    bullets,
    preset,
  });
}
