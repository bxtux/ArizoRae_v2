import { NextResponse } from 'next/server';
import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = session.user.id;

  // Soft-delete: deletedAt timestamp, sessions wiped
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  // NOTE: users_datas/<uid>/ archival is handled by a background Celery task
  // triggered by a periodic cleanup job — not inline here to keep the response fast.

  return NextResponse.json({ ok: true });
}
