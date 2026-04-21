import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { enqueueCelery } from '@/lib/celery-client';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = session.user.id;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  await enqueueCelery('app.tasks.archive_user_data', [userId]);

  return NextResponse.json({ ok: true });
}
