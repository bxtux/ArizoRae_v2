import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { sendMail, resetPasswordEmail } from '@/lib/mail';
import { env } from '@/lib/env';

export default function ResetRequestPage({ searchParams }: { searchParams: { sent?: string } }) {
  async function doReset(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const token = randomUUID();
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
      });
      const link = `${env.PUBLIC_URL}/reset/confirm?token=${token}`;
      await sendMail({ to: email, ...resetPasswordEmail(link, user.firstName) });
    }
    // Réponse identique si compte inconnu (anti-énumération)
  }

  if (searchParams.sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Vérifiez votre boîte mail</h1>
          <p className="text-muted">Si un compte existe pour cette adresse, un lien de réinitialisation vous a été envoyé.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        action={async (fd) => {
          'use server';
          await doReset(fd);
          const { redirect } = await import('next/navigation');
          redirect('/reset?sent=1');
        }}
        className="glass w-full max-w-md p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold">Réinitialiser mon mot de passe</h1>
        <input name="email" type="email" required placeholder="Email" className="input" />
        <button type="submit" className="btn-primary w-full justify-center">Envoyer le lien</button>
      </form>
    </main>
  );
}
