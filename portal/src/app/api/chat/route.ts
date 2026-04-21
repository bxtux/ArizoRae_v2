import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { agentPost } from '@/lib/agent-client';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  message: z.string().min(1).max(4000),
  contextPage: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { message, contextPage } = body.data;
  const userId = session.user.id;

  // Persist user message
  await prisma.chatMessage.create({
    data: { userId, role: 'user', content: message },
  });

  // Call agent-worker (haiku by default)
  const result = await agentPost<{ reply: string }>('/chat', {
    user_id: userId,
    message,
    context_page: contextPage ?? '',
  });

  const reply = (result as { reply: string }).reply;

  await prisma.chatMessage.create({
    data: { userId, role: 'assistant', content: reply },
  });

  return NextResponse.json({ reply });
}
