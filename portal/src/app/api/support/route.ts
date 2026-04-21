import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyAdmin } from '@/lib/gotify';
import { z } from 'zod';

const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { subject, body } = parsed.data;

  await prisma.supportTicket.create({
    data: { userId: session.user.id, subject, body },
  });

  await notifyAdmin(`[Support] ${subject}`, `User ${session.user.email}: ${body.slice(0, 300)}`);

  return NextResponse.json({ ok: true });
}
