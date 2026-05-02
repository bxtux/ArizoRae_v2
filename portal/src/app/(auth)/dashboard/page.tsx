import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { OfferActions } from './OfferActions';
import { RunScraperButton } from './RunScraperButton';
import { LogoutButton } from '@/components/LogoutButton';
import type { Prisma } from '@prisma/client';

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [offers, runningJob] = await Promise.all([
    prisma.jobOffer.findMany({
      where: { userId: session.user.id, status: 'new' },
      orderBy: { score: 'desc' },
      take: 50,
    }),
    prisma.aiJob.findFirst({
      where: { userId: session.user.id, status: 'running' },
      orderBy: { startedAt: 'desc' },
    }),
  ]);
  type DashboardOffer = Prisma.JobOfferGetPayload<Record<string, never>>;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bonjour {session.user.name}</h1>
          <div className="flex gap-3">
            <Link href="/applications" className="btn-ghost text-sm">Candidatures</Link>
            <Link href="/stats" className="btn-ghost text-sm">Stats</Link>
            <Link href="/settings" className="btn-ghost text-sm">Paramètres</Link>
            <LogoutButton />
          </div>
        </div>

        {runningJob && (
          <div className="glass p-4 border border-gold/30 text-gold text-sm animate-pulse">
            Agent en cours : {runningJob.workflow} ({runningJob.model})...
          </div>
        )}

        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Offres disponibles ({offers.length})</h2>
          <RunScraperButton />
        </div>

        {offers.length === 0 && (
          <div className="glass p-10 text-center text-muted">
            <p>Aucune offre pour l&apos;instant. Lancez le scraper !</p>
          </div>
        )}

        <ul className="space-y-3">
          {offers.map((offer: DashboardOffer) => (
            <li key={offer.id} className="glass p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary font-mono font-bold text-sm">{offer.score?.toFixed(0) ?? '?'}</span>
                  <span className="text-xs text-muted">{offer.source}</span>
                </div>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-primary transition-colors truncate block"
                >
                  {offer.title}
                </a>
                <p className="text-sm text-muted">
                  {offer.company ?? 'Entreprise inconnue'} — {offer.location ?? ''}
                </p>
              </div>
              <OfferActions offerId={offer.id} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
