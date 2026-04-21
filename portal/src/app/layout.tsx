import './globals.css';
import type { Metadata } from 'next';
import { RaeChat } from '@/components/rae-chat/RaeChat';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'ArizoRAE',
  description: "Assistant de Recherche Active d'Emploi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg text-text font-sans">
        {children}
        {session?.user && <RaeChat />}
      </body>
    </html>
  );
}
