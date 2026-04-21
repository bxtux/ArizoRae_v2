import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { agentPost } from '@/lib/agent-client';
import { prisma } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const offer = await prisma.jobOffer.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!offer) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const offerDict = {
    id: offer.id,
    title: offer.title,
    company: offer.company,
    location: offer.location,
    url: offer.url,
    source: offer.source,
    score: offer.score,
  };

  const result = await agentPost<{ path: string }>('/workflows/entretien', {
    user_id: session.user.id,
    offer: offerDict,
  });

  return NextResponse.json(result);
}
