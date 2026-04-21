import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function doLogin(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      });
    } catch {
      redirect('/login?error=invalid');
    }
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={doLogin} className="glass w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold">Connexion</h1>
        {searchParams.error && (
          <p className="text-primary text-sm">Email ou mot de passe incorrect, ou email non vérifié.</p>
        )}
        <input name="email" type="email" required placeholder="Email" className="input" />
        <input name="password" type="password" required placeholder="Mot de passe" className="input" />
        <button type="submit" className="btn-primary w-full justify-center">Se connecter</button>
        <div className="flex justify-between text-sm text-muted">
          <Link href="/signup" className="hover:text-text">Créer un compte</Link>
          <Link href="/reset" className="hover:text-text">Mot de passe oublié ?</Link>
        </div>
      </form>
    </main>
  );
}
