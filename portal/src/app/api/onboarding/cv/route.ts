import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { env } from '@/lib/env';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get('cv') as File | null;
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 });
  }

  const dir = join(USERS_DATAS_DIR, session.user.id);
  const { mkdir } = await import('fs/promises');
  await mkdir(dir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(join(dir, 'cv_original.pdf'), Buffer.from(bytes));

  return NextResponse.json({ ok: true });
}
