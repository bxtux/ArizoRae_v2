import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export default async function ResetConfirmPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  if (!token) redirect('/login');

  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row || row.expiresAt < new Date()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Lien invalide ou expiré</h1>
        </div>
      </main>
    );
  }

  async function doConfirm(formData: FormData) {
    'use server';
    const pw = String(formData.get('password') || '');
    if (pw.length < 8) redirect(`/reset/confirm?token=${token}&error=short`);
    const hash = await bcrypt.hash(pw, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row!.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.delete({ where: { token: token! } }),
    ]);
    redirect('/login?reset=1');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={doConfirm} className="glass w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
        <input name="password" type="password" required minLength={8} placeholder="Nouveau mot de passe" className="input" />
        <button type="submit" className="btn-primary w-full justify-center">Enregistrer</button>
      </form>
    </main>
  );
}
