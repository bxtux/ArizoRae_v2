import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enqueueCelery } from '@/lib/celery-client';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const taskId = await enqueueCelery('app.tasks.run_scraper_for_user', [], { user_id: session.user.id });
  return NextResponse.json({ taskId });
}
