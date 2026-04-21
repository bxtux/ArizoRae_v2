import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Bonjour {session.user.name}</h1>
        <p className="text-muted mb-8">Tableau de bord — offres à venir (M3).</p>
        <div className="glass p-8">
          <p className="text-muted">Le dashboard sera peuplé dans les milestones M3 et M4.</p>
        </div>
      </div>
    </main>
  );
}
