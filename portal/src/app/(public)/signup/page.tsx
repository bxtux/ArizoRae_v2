import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendMail, verificationEmail } from '@/lib/mail';
import { env } from '@/lib/env';

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  async function doSignup(formData: FormData) {
    'use server';
    const parsed = schema.safeParse({
      email: formData.get('email'),
      firstName: formData.get('firstName'),
      password: formData.get('password'),
    });
    if (!parsed.success) redirect('/signup?error=invalid');

    const { email, firstName, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect('/signup?error=taken');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, firstName, passwordHash },
    });

    const token = randomUUID();
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const link = `${env.PUBLIC_URL}/verify?token=${token}`;
    await sendMail({ to: email, ...verificationEmail(link, firstName) });

    redirect('/signup/sent');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={doSignup} className="glass w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        {searchParams.error === 'taken' && (
          <p className="text-primary text-sm">Un compte existe déjà pour cette adresse.</p>
        )}
        {searchParams.error === 'invalid' && (
          <p className="text-primary text-sm">Informations invalides.</p>
        )}
        <input name="firstName" required placeholder="Prénom" className="input" />
        <input name="email" type="email" required placeholder="Email" className="input" />
        <input name="password" type="password" required minLength={8} placeholder="Mot de passe (8+ caractères)" className="input" />
        <button type="submit" className="btn-primary w-full justify-center">Créer mon compte</button>
      </form>
    </main>
  );
}
