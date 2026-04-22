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

  let result: { reply: string };
  try {
    result = await agentPost<{ reply: string }>('/chat', {
      user_id: userId,
      message,
      context_page: contextPage ?? '',
    }) as { reply: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('402') || msg.includes('quota') || msg.includes('credit') || msg.includes('429')) {
      return NextResponse.json(
        {
          error: 'quota',
          fallback_mode: 'economic',
          reply: "Le mode standard n'est plus disponible pour le moment. Activez le mode economique pour continuer.",
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: 'agent_error', reply: "L'agent est temporairement indisponible. Réessayez dans quelques instants." },
      { status: 503 }
    );
  }

  const reply = result.reply;

  await prisma.chatMessage.create({
    data: { userId, role: 'assistant', content: reply },
  });

  return NextResponse.json({ reply });
}
