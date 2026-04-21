import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

const schema = z.object({
  metier: z.string().min(1).max(200),
  country: z.string().min(1).max(10),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { metier, country } = body.data;
  const uid = session.user.id;
  const dir = join(USERS_DATAS_DIR, uid);

  await mkdir(dir, { recursive: true });

  const cvPath = join(dir, 'cv_original.pdf');
  const onboardingConfig = { user_id: uid, cv_path: cvPath, metier, country };
  await writeFile(join(dir, 'onboarding.json'), JSON.stringify(onboardingConfig));

  return NextResponse.json({ ok: true });
}
