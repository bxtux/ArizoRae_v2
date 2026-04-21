import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enqueueCelery } from '@/lib/celery-client';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // run_scraper_demo is synchronous (Celery result backend); for MVP we fire-and-wait via task id
  const taskId = await enqueueCelery('app.tasks.run_scraper_demo', [], { user_id: session.user.id });
  return NextResponse.json({ taskId, offers: [] });
}
