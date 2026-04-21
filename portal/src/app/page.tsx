import Link from 'next/link';

export default function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass max-w-2xl p-12 text-center">
        <h1 className="text-5xl font-bold mb-4">
          Arizo<span className="text-primary">RAE</span>
        </h1>
        <p className="text-muted text-lg mb-8">
          Votre agent personnalisé de recherche active d'emploi.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup" className="btn-primary">Créer un compte</Link>
          <Link href="/login" className="btn-ghost">Se connecter</Link>
        </div>
      </div>
    </main>
  );
}
