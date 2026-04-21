import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [totalOffers, appliedOffers, totalApplications, tokenUsage] = await Promise.all([
    prisma.jobOffer.count({ where: { userId } }),
    prisma.jobOffer.count({ where: { userId, status: 'applied' } }),
    prisma.application.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { quotaUsedTokens: true, quotaLimitTokens: true },
    }),
  ]);

  const quotaPct = tokenUsage
    ? Math.round((Number(tokenUsage.quotaUsedTokens) / Number(tokenUsage.quotaLimitTokens)) * 100)
    : 0;

  const recentJobs = await prisma.aiJob.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: { workflow: true, model: true, tokensIn: true, tokensOut: true, status: true, startedAt: true },
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Statistiques</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Offres scrapées', value: totalOffers },
            { label: 'Offres postulées', value: appliedOffers },
            { label: 'Candidatures', value: totalApplications },
            { label: 'Quota tokens', value: `${quotaPct}%` },
          ].map((s) => (
            <div key={s.label} className="glass p-5 text-center">
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="glass p-6">
          <h2 className="text-xl font-semibold mb-4">Utilisation tokens (quota admin)</h2>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${Math.min(quotaPct, 100)}%` }}
            />
          </div>
          <p className="text-sm text-muted mt-2">
            {tokenUsage
              ? `${Number(tokenUsage.quotaUsedTokens).toLocaleString()} / ${Number(tokenUsage.quotaLimitTokens).toLocaleString()} tokens`
              : '—'}
          </p>
        </div>

        <div className="glass p-6">
          <h2 className="text-xl font-semibold mb-4">Derniers jobs IA</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-white/10">
                <th className="text-left pb-2">Workflow</th>
                <th className="text-left pb-2">Modèle</th>
                <th className="text-right pb-2">Tokens in</th>
                <th className="text-right pb-2">Tokens out</th>
                <th className="text-left pb-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 font-mono">{j.workflow}</td>
                  <td className="py-2 text-muted">{j.model}</td>
                  <td className="py-2 text-right">{j.tokensIn.toLocaleString()}</td>
                  <td className="py-2 text-right">{j.tokensOut.toLocaleString()}</td>
                  <td className={`py-2 ${j.status === 'done' ? 'text-green-400' : j.status === 'error' ? 'text-primary' : 'text-gold'}`}>
                    {j.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
