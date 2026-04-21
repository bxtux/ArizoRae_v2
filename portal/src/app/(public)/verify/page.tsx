import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  if (!token) redirect('/login?error=no_token');

  const row = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!row || row.expiresAt < new Date()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Lien invalide ou expiré</h1>
          <p className="text-muted">Veuillez refaire une inscription ou demander un nouveau lien.</p>
        </div>
      </main>
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.delete({ where: { token } }),
  ]);

  redirect('/login?verified=1');
}
