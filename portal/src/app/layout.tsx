import './globals.css';
import type { Metadata } from 'next';
import { RaeChat } from '@/components/rae-chat/RaeChat';
import { QuotaModal } from '@/components/quota-modal/QuotaModal';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'ArizoRAE',
  description: "Assistant de Recherche Active d'Emploi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let quotaExceeded = false;
  let economicConnected = false;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        quotaUsedTokens: true,
        quotaLimitTokens: true,
        anthropicKeyEncrypted: true,
        economicOpenaiSessionEncrypted: true,
        economicOpenaiExpiresAt: true,
      },
    });
    if (u && !u.anthropicKeyEncrypted) {
      quotaExceeded = Number(u.quotaUsedTokens) >= Number(u.quotaLimitTokens);
    }
    economicConnected = !!u?.economicOpenaiSessionEncrypted
      && (!u.economicOpenaiExpiresAt || u.economicOpenaiExpiresAt.getTime() > Date.now());
  }

  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg text-text font-sans">
        {children}
        {session?.user && <RaeChat />}
        {session?.user && <QuotaModal exceeded={quotaExceeded} economicConnected={economicConnected} />}
      </body>
    </html>
  );
}
