import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const applications = await prisma.application.findMany({
    where: { userId: session.user.id },
    include: { offer: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Mes candidatures</h1>

        {applications.length === 0 && (
          <div className="glass p-8 text-center text-muted">
            <p>Aucune candidature pour l&apos;instant.</p>
            <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
              Voir les offres
            </Link>
          </div>
        )}

        <ul className="space-y-4">
          {applications.map((app) => (
            <li key={app.id} className="glass p-5 flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{app.offer.title}</p>
                <p className="text-sm text-muted">{app.offer.company} — {app.offer.location}</p>
                <p className="text-xs text-muted mt-1">
                  {new Date(app.createdAt).toLocaleDateString('fr-BE')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {app.cvPath && (
                  <a href={`/api/files/cv/${app.id}`} className="btn-ghost text-sm px-3 py-1.5">
                    CV
                  </a>
                )}
                {app.letterPath && (
                  <a href={`/api/files/letter/${app.id}`} className="btn-ghost text-sm px-3 py-1.5">
                    Lettre
                  </a>
                )}
                <a href={app.offer.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm px-3 py-1.5">
                  Offre
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
