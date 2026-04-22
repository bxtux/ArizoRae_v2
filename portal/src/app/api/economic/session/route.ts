import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEconomicSessionStatus } from '@/lib/economic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return NextResponse.json(await getEconomicSessionStatus(session.user.id));
}
