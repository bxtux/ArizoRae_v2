import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readFile } from 'fs/promises';
import { join } from 'path';

const USERS_DATAS_DIR = process.env.USERS_DATAS_DIR ?? '/users_datas';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const offer = await prisma.jobOffer.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = join(USERS_DATAS_DIR, session.user.id, 'outputs', `lettre_${params.id}.md`);
  try {
    const content = await readFile(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `inline; filename="lettre_${params.id}.md"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
