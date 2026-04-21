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

  const [cv, letter] = await Promise.all([
    agentPost<{ path: string }>('/workflows/cv', { user_id: session.user.id, offer: offerDict }),
    agentPost<{ path: string }>('/workflows/lettre', { user_id: session.user.id, offer: offerDict }),
  ]);

  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        offerId: offer.id,
        userId: session.user.id,
        cvPath: (cv as { path: string }).path,
        letterPath: (letter as { path: string }).path,
      },
    });
    await tx.jobOffer.update({ where: { id: offer.id }, data: { status: 'applied' } });
    return app;
  });

  return NextResponse.json({ applicationId: application.id });
}
