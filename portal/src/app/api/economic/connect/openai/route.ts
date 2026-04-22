import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encryptApiKey } from '@/lib/crypto';
import { z } from 'zod';

const schema = z.object({
  sessionToken: z.string().min(20).max(10000),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(30),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const expiresAt = new Date(Date.now() + body.data.expiresInDays * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      economicOpenaiSessionEncrypted: encryptApiKey(body.data.sessionToken),
      economicOpenaiExpiresAt: expiresAt,
    },
  });

  return NextResponse.json({
    ok: true,
    connected: true,
    expiresAt: expiresAt.toISOString(),
  });
}
