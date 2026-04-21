import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { agentPost } from '@/lib/agent-client';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const reason = body.success ? body.data.reason : undefined;

  const offer = await prisma.jobOffer.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!offer) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.jobOffer.update({
    where: { id: offer.id },
    data: { status: 'not_interested', notInterestedReason: reason ?? null },
  });

  // If reason provided, agent-worker proposes scraper diff
  if (reason) {
    agentPost('/scraper/adapt', {
      user_id: session.user.id,
      diff_request: `L'utilisateur a refusé l'offre "${offer.title}" avec la raison: ${reason}. Propose un diff pour mieux filtrer ce type d'offre.`,
    }).catch(() => null); // fire-and-forget
  }

  return NextResponse.json({ ok: true });
}
